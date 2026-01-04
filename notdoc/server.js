app.post("/save-token", (req, res) => {
  const { token } = req.body;
  // Save token to DB or file
  console.log("Saved token:", token);
  res.sendStatus(200);
});
