const mongoose = require("mongoose");

const connectToDatabase = async () => {
  try {
    await mongoose.connect(
      `mongodb+srv://gustavobarrosaraujo10:Gu290901.@gustavoaraujo.s8hht.mongodb.net/?appName=gustavoAraujo`,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    );
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  }
};

module.exports = connectToDatabase;
