# Project Blueprint: Intelligent HAR Analyzer

## Overview

The Intelligent HAR Analyzer is a web-based tool designed to automate the process of converting HTTP Archive (HAR) files into LoliCode scripts. It provides a sophisticated and user-friendly interface for developers and security analysts to analyze network traffic, identify critical API endpoints, and generate automation scripts for various testing and analysis scenarios.

## Core Features

- **Advanced Endpoint Filtering:** The application employs a multi-dimensional scoring system to identify the most relevant and critical network requests within a HAR file. This system evaluates endpoints based on a variety of factors, including:
    - **Relevance Score:** Determines the importance of an endpoint based on user-defined patterns and resource types.
    - **Security Score:** Assesses the security implications of a request by identifying authentication tokens, sensitive data, and state-changing operations.
    - **Business Logic Score:** Prioritizes requests that are likely to be part of a critical business workflow, such as API calls and form submissions.
    - **Temporal and Contextual Analysis:** Considers the timing and sequence of requests to understand their role within the broader application flow.

- **Automated LoliCode Generation:** Once the critical requests have been identified, the application automatically generates a LoliCode script that replicates the corresponding actions. This script can then be used for a variety of purposes, including:
    - **Security Testing:** Replaying and fuzzing requests to identify vulnerabilities.
    - **Performance Testing:** Simulating user interactions to measure application performance.
    - **Automated Integration Testing:** Creating automated tests for API endpoints and user workflows.
    - **Comprehensive Code Templates:** Supports generation of LoliCode for single requests, authentication failure/success flows, and multi-step behavioral flows.

- **Intelligent Token Detection:** Automatically identifies and extracts various types of tokens (e.g., CSRF, Session, JWT, API Keys) from headers, cookies, URLs, request bodies, and response bodies, enhancing the accuracy of generated scripts and providing security insights.

- **Behavioral Flow Detection:** Analyzes sequences of requests to identify common behavioral patterns, such as authentication flows, adding significant context and structure to the generated LoliCode.

- **Detailed Metrics & Warnings:** Provides comprehensive processing metrics, including total/significant requests, processing times, and resource type distribution. Generates security warnings (e.g., missing CSRF, insecure authentication, session fixation) to highlight potential vulnerabilities.

- **User-Friendly Interface:** The application features a clean and intuitive user interface that simplifies the process of uploading HAR files, initiating the analysis, and viewing the generated LoliCode.

## Implemented Changes

- **Enhanced Multi-Stage Authentication Flow Detection:** Refactored the `BehavioralPatternMatcher` to support more complex and flexible authentication flows.
    - Introduced an `isOptional` flag for pattern steps, allowing the definition of non-mandatory requests within a flow (e.g., an optional `/userinfo` call in OIDC).
    - Updated the pattern matching algorithm to correctly process patterns with optional steps, significantly improving the accuracy of multi-stage flow detection.
- **Added OpenID Connect (OIDC) Support:** Implemented a new, detailed pattern for detecting the OIDC Authorization Code Grant flow. The system can now distinguish between standard OAuth 2.0 and OIDC, and correctly identify OIDC-specific elements like the `id_token`.
- **Fixed URL Pattern Matching Bug:** Corrected a bug in the `BehavioralPatternMatcher` that prevented it from correctly matching patterns with multiple URL regexes. This fix improves the reliability of all existing and new authentication patterns.
- **Refactored Filtering Logic:** Replaced the previous boolean-based filtering with a more sophisticated, multi-dimensional scoring system. This allows for a more nuanced and accurate identification of critical endpoints.
- **Introduced EndpointScoringService:** Created a dedicated service to handle the scoring of HAR entries. This service incapsulates the scoring logic and makes it easier to maintain and extend.
- **Updated AsyncHarProcessor:** Refactored the main processing unit to use the new `EndpointScoringService` and to streamline the analysis workflow. The `AsyncHarProcessor` now includes full implementations for:
    - **Token Detection Service:** Robustly identifies various token types across different HAR entry locations.
    - **Code Generation Service:** Generates LoliCode based on various templates (single request, authentication failure/success, multi-step flow, generic), incorporating detected tokens and behavioral flows.
    - **Behavioral Pattern Detection:** Identifies complex multi-step user flows, adding structure and intelligence to the analysis.
    - **Comprehensive Metrics Tracking:** Provides detailed performance and analysis metrics.
    - **Security Warning Generation:** Automatically identifies and reports potential security issues.
- **Restored "Start Analysis" Button:** Reintroduced the "Start Analysis" button to give users explicit control over when the analysis begins. This ensures a more predictable and user-friendly experience.
- **Improved UI/UX:** Refined the user interface to provide a more intuitive and streamlined experience. The layout has been updated to better guide the user through the process of uploading a HAR file and initiating the analysis.

## Known Vulnerabilities

- **`esbuild` Vulnerability (GHSA-67mh-4wv8-2f99):** The project has a moderate severity vulnerability in the `esbuild` package, a dependency of `vite`. This vulnerability allows any website to send requests to the development server and read the response. At present, there is no direct fix available for this vulnerability.

## Future Enhancements

- **Interactive Endpoint Selection:** Allow users to manually select or deselect endpoints to be included in the generated LoliCode.
- **Support for Additional Scripting Languages:** Extend the code generation capabilities to support other scripting languages, such as Python or JavaScript.
- **Integration with CI/CD Pipelines:** Provide a command-line interface (CLI) or API that allows the analyzer to be integrated into automated testing and deployment pipelines.
