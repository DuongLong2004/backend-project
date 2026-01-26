
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendResponse } = require("../utils/response");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendResponse(res, 400, "error", "Email and password are required");
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return sendResponse(res, 401, "error", "Invalid email or password");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendResponse(res, 401, "error", "Invalid email or password");
    }

    // 🔑 CREATE JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role, //gắn role để phân quyền
      },
      process.env.JWT_SECRET,
      {expiresIn: "1h", expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return sendResponse(res, 200, "success", "Login successfully", {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        age: user.age,
      },
    });
  } catch (err) {
    return sendResponse(res, 500, "error", err.message);
  }
};
