import { McpServer } from '@modelcontextprotocol/server';
import type { DataFitOrchestrator } from '../core/orchestrator';
import { registerDataFitTools } from './tools';

export function createDataFitMcpServer(orchestrator: DataFitOrchestrator): McpServer {
  const server = new McpServer({ name: 'datafit', version: '1.0.0' }, {
    instructions: 'Use DataFit tools in order: discover, plan evidence, resolve gaps, inspect, check fit, validate only justified relationships, then recommend/build a result. Registry matches and structural assessments are not execution validation.',
  });
  registerDataFitTools(server, orchestrator);
  return server;
}
