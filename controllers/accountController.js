import { prisma } from "../libs/database.js";

export const getAccounts = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;

    // Get one account
    if (id) {
      const account = await prisma.account.findFirst({
        where: {
          id: Number(id),
          user_id: userId,
        },
      });

      if (!account) {
        return res.status(404).json({
          status: "failed",
          message: "Account not found!",
        });
      }

      return res.status(200).json({
        status: "success",
        data: account,
      });
    }

    // Get all accounts
    const accounts = await prisma.account.findMany({
      where: {
        user_id: userId,
      },
    });

    res.status(200).json({
      status: "success",
      data: accounts,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      status: "failed",
      message: error.message,
    });
  }
};

export const createAccount = async (req, res) => {
  try {
    const { userId } = req.user;

    const { name, amount, account_number } = req.body;

    const accountExists = await prisma.account.findFirst({
      where: {
        user_id: userId,
        account_name: name,
      },
    });

    if (accountExists) {
      return res.status(409).json({
        status: "failed",
        message: "Account already created.",
      });
    }

    const account = await prisma.account.create({
      data: {
        user_id: userId,
        account_name: name,
        account_number,
        account_balance: amount,
      },
    });

    // Initial deposit transaction
    const description = `${account.account_name} (Initial Deposit)`;

    await prisma.transaction.create({
      data: {
        user_id: userId,
        description,
        type: "income",
        status: "Completed",
        amount,
        source: account.account_name,
      },
    });

    res.status(201).json({
      status: "success",
      message: `${account.account_name} Account created successfully`,
      data: account,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      status: "failed",
      message: error.message,
    });
  }
};

export const addMoneyToAccount = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    const { amount } = req.body;

    const newAmount = Number(amount);

    const accountInformation = await prisma.account.update({
      where: {
        id: Number(id),
      },
      data: {
        account_balance: {
          increment: newAmount,
        },
      },
    });

    const description = `${accountInformation.account_name} (Deposit)`;

    await prisma.transaction.create({
      data: {
        user_id: userId,
        description,
        type: "income",
        status: "Completed",
        amount: newAmount,
        source: accountInformation.account_name,
      },
    });

    res.status(200).json({
      status: "success",
      message: "Operation completed successfully",
      data: accountInformation,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      status: "failed",
      message: error.message,
    });
  }
};
