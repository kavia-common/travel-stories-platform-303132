const cloudinary = require('cloudinary').v2;

/**
 * Returns true if all required Cloudinary env vars are present.
 */
function hasCloudinaryEnv() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Ensures Cloudinary SDK is configured.
 * Throws a helpful error if credentials are missing.
 */
function ensureCloudinaryConfigured() {
  if (!hasCloudinaryEnv()) {
    // Note: values must be provided via environment (.env in container root).
    throw new Error(
      'Cloudinary is not configured. Missing one or more env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.'
    );
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Uploads a local file to Cloudinary and returns the upload response.
 * @param {string} filePath - local filesystem path (e.g., from Multer disk storage)
 * @param {object} [options] - Cloudinary upload options
 */
async function uploadLocalFileToCloudinary(filePath, options = {}) {
  ensureCloudinaryConfigured();

  return cloudinary.uploader.upload(filePath, {
    resource_type: 'image',
    ...options,
  });
}

module.exports = {
  cloudinary,
  ensureCloudinaryConfigured,
  uploadLocalFileToCloudinary,
};

