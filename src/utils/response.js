exports.sendResponse = (
  res,
  statusCode,
  status,
  message,
  data = null
) => {
  return res.status(statusCode).json({
    status,
    message,
    data,
  });
};
