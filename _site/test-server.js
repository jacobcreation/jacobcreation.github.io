const express = require('express');
const path = require('path');
const app = express();
const port = 5173;

app.use(express.static(__dirname));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
