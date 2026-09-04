import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createDataFitOrchestrator } from '../core/orchestrator';
import { createDataFitMcpServer } from './server';

const live = process.env.DATAFIT_LIVE === '1';
const orchestrator = await createDataFitOrchestrator({ live });
serveStdio(() => createDataFitMcpServer(orchestrator));
console.error(`DataFit MCP running on stdio (${orchestrator.catalog.source} catalogue; state is in-memory).`);
