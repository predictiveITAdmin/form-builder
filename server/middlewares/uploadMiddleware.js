const multer = require("multer");

const maxMb = Number(process.env.FILE_UPLOAD_MAX_MB || 30);

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxMb * 1024 * 1024,
  },
});
