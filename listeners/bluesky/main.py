import asyncio
import websockets
import logging
import json
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

# --- Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

API_BASE_URL = os.environ.get("API_BASE_URL")
ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY")
WEBSOCKET_BASE_URL = "wss://jetstream1.us-west.bsky.network/subscribe"

if not API_BASE_URL:
    logging.critical("FATAL ERROR: API_BASE_URL is not set in the environment. Please check your .env file.")
    exit()

SUBSCRIBED_AUTHORS_DATA = {}

# --- API Fetching ---
async def fetch_subscribed_authors():
    """
    Fetches the list of subscribed authors from the API endpoint.
    Populates the global SUBSCRIBED_AUTHORS_DATA dictionary and
    returns a list of bsky_dids for websocket subscription.
    """
    authors_endpoint = f"{API_BASE_URL}authors/bluesky"
    logging.info(f"Fetching authors from API at {authors_endpoint}")
    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {ADMIN_API_KEY}"
            }
            response = await client.get(authors_endpoint, headers=headers, timeout=10.0)
            response.raise_for_status()
            authors = response.json()
            if not authors:
                logging.warning("API returned no authors.")
                return []
            SUBSCRIBED_AUTHORS_DATA.clear()
            bsky_dids = []
            for author in authors:
                did = author.get('platform_id')
                if did:
                    bsky_dids.append(did)
                    SUBSCRIBED_AUTHORS_DATA[did] = {
                        'id': author.get('id'),
                        'name': author.get('name'),
                        'author_context': author.get('author_context')
                    }
            logging.info(f"Successfully fetched {len(bsky_dids)} authors.")
            return bsky_dids
    except httpx.RequestError as e:
        logging.error(f"Error fetching authors from API: {e}")
    except json.JSONDecodeError:
        logging.error("Failed to decode JSON response from API.")
    except Exception as e:
        logging.error(f"An unexpected error occurred during author fetch: {e}")
    return []

# --- Websocket ---
async def websocket_client(subscribed_dids):
    """
    Connects to the BlueSky websocket and listens for messages
    for the provided list of decentralized identifiers (dids).
    """
    if not subscribed_dids:
        logging.warning("No authors to subscribe to. Websocket client will not start.")
        return

    params = [f"wantedDids={did}" for did in subscribed_dids]
    param_string = "&".join(params)
    websocket_url = f"{WEBSOCKET_BASE_URL}?{param_string}"

    while True:
        try:
            async with websockets.connect(websocket_url) as websocket:
                logging.info(f"Worker connected to WebSocket. Listening for new posts...")
                async for message in websocket:
                    try:
                        data = json.loads(message)
                        if data.get("kind") == "commit":
                            commit = data.get("commit", {})
                            if commit.get("operation") == "create":
                                did = data.get("did")
                                author_info = SUBSCRIBED_AUTHORS_DATA.get(did, {})
                                author_id = author_info.get("id")
                                collection = commit.get("collection", "N/A")

                                if collection == "app.bsky.feed.post":
                                    record = commit.get("record", {})
                                    post_text = record.get("text", "")
                                    logging.info(f"   -> New Post from author {author_id}: {post_text[:100]}...")

                                    if author_id and post_text:
                                        trigger_workflow_url = f"{API_BASE_URL}process-tweet/trigger-workflow"
                                        payload = {
                                            "tweet_author_id": author_id,
                                            "tweet_content": post_text
                                        }
                                        headers = {
                                            "Authorization": f"Bearer {ADMIN_API_KEY}"
                                        }

                                        try:
                                            async with httpx.AsyncClient() as client:
                                                logging.info(f"   -> Sending post to workflow API: {trigger_workflow_url}")
                                                response = await client.post(trigger_workflow_url, json=payload, headers=headers, timeout=15.0)
                                                response.raise_for_status() # Raise exception for 4xx/5xx responses
                                                logging.info(f"   -> Successfully triggered workflow. Status: {response.status_code}")
                                        except httpx.HTTPStatusError as e:
                                            logging.error(f"   -> API request failed with status {e.response.status_code}: {e.response.text}")
                                        except httpx.RequestError as e:
                                            logging.error(f"   -> An error occurred while calling the workflow API: {e}")

                    except json.JSONDecodeError:
                        logging.warning("Could not decode JSON from websocket message.")
                    except Exception as e:
                        logging.error(f"An error occurred while processing a message: {e}")

        except websockets.exceptions.ConnectionClosed:
            logging.warning("WebSocket connection closed. Reconnecting in 5 seconds...")
        except Exception as e:
            logging.error(f"An error occurred in websocket client: {e}. Reconnecting in 15 seconds...")
            await asyncio.sleep(10)
        
        await asyncio.sleep(5)

async def main():
    """Main function to run the worker."""
    logging.info("Worker process starting...")
    subscribed_dids = await fetch_subscribed_authors()
    await websocket_client(subscribed_dids)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Worker process shutting down.")

