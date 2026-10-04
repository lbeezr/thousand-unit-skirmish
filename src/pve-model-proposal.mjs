// Compatibility for existing offline adapters; removal ownership/criteria are
// recorded in docs/model-controlled-opponent-research.md.
export {
  MODEL_PROPOSAL_SCHEMA_VERSION,
  MODEL_PROPOSAL_LIMITS,
  parseModelProposal,
  attachModelProposalOpponent,
} from './server/pve-model-proposal.mjs';
