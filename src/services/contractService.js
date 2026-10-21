const { StrKey } = require('@stellar/stellar-sdk');

const CONTRACT_ID = process.env.CONTRACT_ID;

if (!CONTRACT_ID) {
  throw new Error(
    'CONTRACT_ID environment variable is required but was not provided.'
  );
}

if (!StrKey.isValidContract(CONTRACT_ID)) {
  throw new Error(
    `Invalid CONTRACT_ID "${CONTRACT_ID}": expected a valid Soroban contract address starting with "C".`
  );
}

module.exports = {
  CONTRACT_ID,
};
