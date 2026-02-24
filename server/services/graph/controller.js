const { graphClient } = require("../auth/utils");

const getMailboxes = async (req, res, next) => {
  try {
    const { search } = req.query;
    
    let queryObj = graphClient.api('/users')
        .select('displayName,mail,userPrincipalName')
        .top(100);

    if (search) {
        // Microsoft Graph requires `"displayName:search_term" OR "mail:search_term"` ($search does not support userPrincipalName)
        queryObj = queryObj.header('ConsistencyLevel', 'eventual')
                           .query({ $search: `"displayName:${search}" OR "mail:${search}"` });
    }

    const response = await queryObj.get();

    // The users might not have mail setup, so fallback to userPrincipalName
    const mailboxes = response.value
      .filter(u => u.mail || u.userPrincipalName)
      .map(u => ({
      label: u.displayName,
      value: u.mail || u.userPrincipalName,
    }));

    return res.json({ mailboxes });
  } catch (error) {
    next(error)
  }
};

module.exports = {
  getMailboxes,
};
