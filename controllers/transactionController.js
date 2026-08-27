import { prisma } from "../libs/database.js";
import { getMonthName } from "../libs/index.js";

export const getTransactions = async (req, res) => {
  try {
    const { userId } = req.user;

    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const { df, dt, s } = req.query;

    const startDate = new Date(df || sevenDaysAgo);
    const endDate = new Date(dt || today);

    const transactions = await prisma.transaction.findMany({
      where: {
        user_id: userId,

        createdAt: {
          gte: startDate,
          lte: endDate,
        },

        ...(s && {
          OR: [
            {
              description: {
                contains: s,
                mode: "insensitive",
              },
            },
            {
              status: {
                contains: s,
                mode: "insensitive",
              },
            },
            {
              source: {
                contains: s,
                mode: "insensitive",
              },
            },
          ],
        }),
      },

      orderBy: {
        id: "desc",
      },
    });

    res.status(200).json({
      status: "success",
      data: transactions,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      status: "failed",
      message: error.message,
    });
  }
};

export const getDashboardInformation = async (req, res) => {
  try {
    const { userId } = req.user;

    // Get all transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        user_id: userId,
      },
    });

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((transaction) => {
      const amount = Number(transaction.amount);

      if (transaction.type === "income") {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }
    });

    const availableBalance = totalIncome - totalExpense;

    // Monthly chart data
    const year = new Date().getFullYear();

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const yearTransactions = await prisma.transaction.findMany({
      where: {
        user_id: userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const data = new Array(12).fill(null).map((_, index) => {
      const monthTransactions = yearTransactions.filter(
        (transaction) => transaction.createdAt.getMonth() === index,
      );

      let income = 0;
      let expense = 0;

      monthTransactions.forEach((transaction) => {
        const amount = Number(transaction.amount);

        if (transaction.type === "income") {
          income += amount;
        } else {
          expense += amount;
        }
      });

      return {
        label: getMonthName(index),
        income,
        expense,
      };
    });

    // Last 5 transactions
    const lastTransactions = await prisma.transaction.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        id: "desc",
      },
      take: 5,
    });

    // Last 4 accounts
    const lastAccount = await prisma.account.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        id: "desc",
      },
      take: 4,
    });

    res.status(200).json({
      status: "success",
      availableBalance,
      totalIncome,
      totalExpense,
      chartData: data,
      lastTransactions,
      lastAccount,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      status: "failed",
      message: error.message,
    });
  }
};

export const addTransaction = async (req, res) => {
  try {
    const { userId } = req.user;
    const { account_id } = req.params;
    const { description, source, amount } = req.body;

    if (!description || !source || !amount) {
      return res.status(400).json({
        status: "failed",
        message: "Provide Required Fields!",
      });
    }

    const newAmount = Number(amount);

    if (newAmount <= 0) {
      return res.status(400).json({
        status: "failed",
        message: "Amount should be greater than 0.",
      });
    }

    const accountInfo = await prisma.account.findFirst({
      where: {
        id: Number(account_id),
        user_id: userId,
      },
    });

    if (!accountInfo) {
      return res.status(404).json({
        status: "failed",
        message: "Invalid account information.",
      });
    }

    if (Number(accountInfo.account_balance) < newAmount) {
      return res.status(403).json({
        status: "failed",
        message: "Transaction failed. Insufficient account balance.",
      });
    }

    await prisma.$transaction([
      prisma.account.update({
        where: {
          id: Number(account_id),
        },
        data: {
          account_balance: {
            decrement: newAmount,
          },
        },
      }),

      prisma.transaction.create({
        data: {
          user_id: userId,
          description,
          type: "expense",
          status: "Completed",
          amount: newAmount,
          source,
        },
      }),
    ]);

    res.status(200).json({
      status: "success",
      message: "Transaction completed successfully.",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      status: "failed",
      message: error.message,
    });
  }
};

export const transferMoneyToAccount = async (req, res) => {
  try {
    const { userId } = req.user;

    const { from_account, to_account, amount } = req.body;

    if (!from_account || !to_account || !amount) {
      return res.status(400).json({
        status: "failed",
        message: "Provide Required Fields!",
      });
    }

    const newAmount = Number(amount);

    if (newAmount <= 0) {
      return res.status(400).json({
        status: "failed",
        message: "Amount should be greater than 0.",
      });
    }

    if (Number(from_account) === Number(to_account)) {
      return res.status(400).json({
        status: "failed",
        message: "Cannot transfer money to the same account.",
      });
    }

    const fromAccount = await prisma.account.findFirst({
      where: {
        id: Number(from_account),
        user_id: userId,
      },
    });

    const toAccount = await prisma.account.findFirst({
      where: {
        id: Number(to_account),
        user_id: userId,
      },
    });

    if (!fromAccount || !toAccount) {
      return res.status(404).json({
        status: "failed",
        message: "Account information not found.",
      });
    }

    if (Number(fromAccount.account_balance) < newAmount) {
      return res.status(403).json({
        status: "failed",
        message: "Transfer failed. Insufficient account balance.",
      });
    }

    const description = `Transfer (${fromAccount.account_name} - ${toAccount.account_name})`;

    const description1 = `Received (${fromAccount.account_name} - ${toAccount.account_name})`;

    await prisma.$transaction([
      prisma.account.update({
        where: {
          id: Number(from_account),
        },
        data: {
          account_balance: {
            decrement: newAmount,
          },
        },
      }),

      prisma.account.update({
        where: {
          id: Number(to_account),
        },
        data: {
          account_balance: {
            increment: newAmount,
          },
        },
      }),

      prisma.transaction.create({
        data: {
          user_id: userId,
          description,
          type: "expense",
          status: "Completed",
          amount: newAmount,
          source: fromAccount.account_name,
        },
      }),

      prisma.transaction.create({
        data: {
          user_id: userId,
          description: description1,
          type: "income",
          status: "Completed",
          amount: newAmount,
          source: toAccount.account_name,
        },
      }),
    ]);

    res.status(200).json({
      status: "success",
      message: "Transfer completed successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      status: "failed",
      message: error.message,
    });
  }
};
