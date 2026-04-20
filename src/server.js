require('dotenv').config();

const app = require('./app');
const connectDb = require('./config/connectDb');

const port = Number(process.env.PORT || 4000);

async function startServer() {
  await connectDb();

  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });
}

startServer().catch(error => {
  console.error('Failed to start backend:', error);
  process.exit(1);
});