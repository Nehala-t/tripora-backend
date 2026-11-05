import multer from "multer";
import storage from "../config/cloudinaryStorage.js";

const upload = multer({
  storage: storage,
});

export default upload;