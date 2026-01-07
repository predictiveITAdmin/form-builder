const queries = require("./queries");

module.exports = {
  listResponses: async (req, res) => {
    try {
      const result = await queries.getResponses();

      return res.status(200).json(result);
    } catch (err) {
      res.status(500).json(err);
    }
  },

  getResponseGraph: async (req, res) => {
    const response_id = req.params.responseId;
    console.log(response_id);
    try {
      const result = await queries.getResponseById(response_id);

      return res.status(200).json(result[0]);
    } catch (err) {
      res.status(500).json(err);
    }
  },
};
