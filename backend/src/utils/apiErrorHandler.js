export const ApiError = (err, req, res, next) => {
    console.error("🔥 ERROR:", err.stack);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Something went wrong!",
    });
  };
  