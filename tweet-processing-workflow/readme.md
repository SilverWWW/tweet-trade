# Tweet Trade Workflow

## Overview

The Tweet Trade workflow is an automated analysis pipeline that evaluates the stock market impact of a social media post. It determines if a given "tweet" is market-sensitive, and if so, deploys an AI agent to research and generate actionable trade recommendations. The workflow is designed for API-driven execution, reporting its final status and results to a specified completion webhook.

## Workflow Logic

The process executes in the following sequence:

1.  **Ingestion**: The workflow starts by receiving tweet data, a unique process ID, and a callback URL for completion reporting.

2.  **Triage**: An initial LLM (`gpt-5-nano`) performs a quick analysis to determine if the tweet has the potential to affect the stock market. It outputs a simple `yes` or `no` determination.

3.  **Routing**:
    * If the determination is `no`, the workflow immediately reports a `status: ok` with `market_effect: no` to the completion webhook and terminates.
    * If `yes`, the workflow proceeds to the primary analysis stage.

4.  **Agent-based Analysis**: A `ReAct` agent powered by `gpt-5-mini` is activated. This agent assumes the role of a financial analyst and has access to **Yahoo Finance** tools for fetching ticker data and news. It uses the initial triage results and its tools to formulate a list of specific trades.

5.  **Output & Reporting**: The agent's proposed trades are parsed and validated.
    * **On Success**: A JSON payload containing the `tweet_process_id`, `status: ok`, `market_effect: yes`, and the list of `trades` is sent to the completion webhook.
    * **On Failure**: If the agent fails to generate trades or if any step encounters a runtime error (e.g., JSON parsing failure), a detailed error payload is sent to the completion webhook.

## I/O Configuration

### Input Variables

The workflow is initiated with the following parameters:

-   `author` (string): The author of the social media post.
-   `tweet_content` (string): The full text of the post.
-   `author_context` (string): Relevant background information on the author.
-   `tweet_process_id` (string): A unique ID to track the workflow execution.
-   `completion_url` (string): The webhook URL to receive the final status report.

### Output Structure (via Webhook)

The workflow reports its result by sending a POST request to the `completion_url` with a JSON body.

**Success (with trades):**
```json
{
  "tweet_process_id": "unique-id-123",
  "status": "ok",
  "market_effect": "yes",
  "trades": [
    {
      "stock_ticker": "NVDA",
      "timeline": 365,
      "reasoning": "...",
      "confidence": 0.65
    }
  ]
}
```

## Hosting and Configuration Note
This workflow is designed to be executed on the Dify platform (either cloud or self-hosted). The .yml file included in this repository is the declarative DSL (Domain-Specific Language) configuration for the entire workflow. It can be directly imported into a Dify application to replicate this setup.