module.exports = {
  api: {
    input: 'http://localhost:3000/openapi.json',
    output: {
      target: './sdk/src/api.ts',
      client: 'axios',
      mode: 'split'
    }
  }
};