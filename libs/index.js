import bcrypt from "bcrypt";
import JWT from "jsonwebtoken";

export const hashPassword = async (userValue) => {
  const hashedPassword = await bcrypt.hash(userValue, 10);
  return hashedPassword;
};

export const comparePassword = async (userPassword, password) => {
  try {
    const isMatch = await bcrypt.compare(userPassword, password);
    return isMatch;
  } catch (error) {
    console.log(error);
  }
};

export const createJWT = (id) => {
  return JWT.sign({ userId: id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};
