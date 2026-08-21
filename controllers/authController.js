import { prisma } from "../libs/database.js";
import { comparePassword, createJWT, hashPassword } from "../libs/index.js";

export const signupUser = async (req, res) => {
  try {
    const { firstName, email, password } = req.body;

    if (!(firstName || email || password)) {
      return res.status(404).json({
        status: "failed",
        message: "Provide Required Fields!",
      });
    }

    const userExist = await prisma.user.findUnique({
      where: { email: email },
    });

    if (userExist) {
      return res.status(409).json({
        status: "failed",
        message: "Email Address already exists. Try Login.",
      });
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        firstName,
        email,
        password: hashedPassword,
      },
    });

    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      status: "success",
      message: "User account created successfully",
      user: userWithoutPassword,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ status: "failed", message: error.message });
  }
};

export const signinUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return res.status(404).json({
        status: "failed",
        message: "Invalid email or password",
      });
    }

    const isMatch = await comparePassword(password, user.password);

    if (!isMatch) {
      return res.status(404).json({
        status: "failed",
        message: "Invalid email or password",
      });
    }

    const token = createJWT(user.id);

    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      status: "success",
      message: "Login successful",
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ status: "failed", message: error.message });
  }
};
