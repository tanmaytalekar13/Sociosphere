const multer = require("multer");
const upload = multer(); // Use in-memory storage

const { Provider, providerValidationSchema } = require("../models/provider");
const supabase = require("../config/supabase");

exports.uploadImage = async (req, res, next) => {
  try {
    // Check if the file is received
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const provider = await Provider.findById(req.user?._id);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }
    const providerId = req.user?._id;
    // Save the uploaded image URL to the database
    const { originalname, buffer, mimetype } = req.file;
    const filePath = `providers/${req.user._id}-${Date.now()}.jpg`;

    // Upload file to Supabase storage
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET_NAME)
      .upload(filePath, buffer, { contentType: mimetype });

    if (error) {
      console.error("File upload error:", error.message);
      return res
        .status(500)
        .json({ message: "File upload failed", error: error.message });
    }

    console.log("Upload Success:", data);

    // Get the public URL of the uploaded file
    const { data: publicURLData, error: urlError } = supabase.storage
      .from(process.env.SUPABASE_BUCKET_NAME)
      .getPublicUrl(filePath);

    if (urlError || !publicURLData?.publicUrl) {
      console.error(
        "Error getting public URL:",
        urlError ? urlError.message : "Invalid URL"
      );
      return res.status(500).json({
        message: "Error getting public URL",
        error: urlError?.message || "Invalid URL",
      });
    }

    console.log("Public URL:", publicURLData.publicUrl);
    provider.image = publicURLData.publicUrl;
    await provider.save();
   res.redirect("/provider/dashboard");
  } catch (error) {
    console.error("Error:", error.message);
    res
      .status(500)
      .json({ message: "Failed to upload image", error: error.message });
  }
};
exports.updateImage = async (req, res, next) => {
  try {
    // Find the provider in the database
    const provider = await Provider.findById(req.user._id);
    if (!provider) {
      return res.status(404).send("Provider not found");
    }

    // Check if an image file is uploaded
    if (!req.file) {
      return res.status(400).send("No image file provided");
    }

    // Delete the existing image if it exists and matches the user ID
    if (provider.image) {
      // Extract the file name from the URL (assuming the URL format is known)
      const existingFileName = provider.image.split('/').pop(); // Extracts the last part of the URL (filename)

      // Check if the existing file name starts with the user ID
      if (existingFileName.startsWith(req.user._id)) {
        // Construct the full file path to delete
        const existingFilePath = `providers/${existingFileName}`;

        // Delete the file from Supabase storage
        const { error: deleteError } = await supabase.storage
          .from(process.env.SUPABASE_BUCKET_NAME)
          .remove([existingFilePath]);

        if (deleteError) {
          console.error("Supabase delete error:", deleteError);
          return res.status(500).send("Failed to delete existing image from storage");
        }
      } else {
        console.error("Existing file does not match user ID.");
        return res.status(400).send("Existing image does not match the user ID");
      }
    }

    // Upload the new image to Supabase
    const fileName = `providers/${req.user._id}-${Date.now()}.jpg`;
    const { data, error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET_NAME) // Replace with your bucket name
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true, // Overwrites if a file with the same name exists
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return res.status(500).send("Failed to upload image to storage");
    }

    // Get the public URL of the uploaded file
    const { data: publicUrlData } = supabase.storage
      .from(process.env.SUPABASE_BUCKET_NAME)
      .getPublicUrl(fileName);

    // Update the provider document with the new public URL
    provider.image = publicUrlData.publicUrl;
    await provider.save();

    res.redirect("/provider/dashboard");
  } catch (error) {
    console.error("Error updating image:", error);
    res.status(500).send("Error updating image");
  }
};
exports.Portfolio = async (req, res, next) => {
  try {
    const provider = await Provider.findById(req.user._id);
    if (!provider) {
      return res.status(404).send("Provider not found");
    }
    if (!req.file) {
      return res.status(400).send("No portfolio file provided");
    }
    const isImage = req.file.mimetype.startsWith("image/");
    const isVideo = req.file.mimetype.startsWith("video/");
    if (!isImage && !isVideo) {
      return res
        .status(400)
        .send("Invalid file type. Only images and videos are allowed.");
    }
    const fileName = `portfolio/${req.user._id}/${Date.now()}-${
      req.file.originalname
    }`;

    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET_NAME)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return res.status(500).send("Failed to upload file to storage");
    }
    const { data: publicUrlData } = supabase.storage
      .from(process.env.SUPABASE_BUCKET_NAME)
      .getPublicUrl(fileName);
    if (!publicUrlData) {
      return res.status(500).send("Failed to retrieve public URL");
    }
    // Update the provider's portfolio
    const portfolioEntry = {
      title: req.body.title || "Untitled",
      description: req.body.description || "",
      url: publicUrlData.publicUrl,
      dateUploaded: new Date(),
    };

    if (isImage) {
      provider.portfolio.images.push(portfolioEntry);
    } else if (isVideo) {
      provider.portfolio.videos.push(portfolioEntry);
    }

    await provider.save();

    res.redirect("/provider/portfolio");
  } catch (error) {
    res.status(404).send(error)
  }
};
exports.PortfolioDelete=async (req, res) => {
  try {
    const provider = await Provider.findById(req.user._id);
    if (!provider) {
      return res.status(404).send('Provider not found');
    }

    const { id } = req.body; // Assuming the id is passed directly in the body

    if (!id) {
      return res.status(400).json({ success: false, message: 'Item ID is required.' });
    }

    // Find the item in the images or videos array
    const imageIndex = provider.portfolio.images.findIndex(image => image._id.toString() === id);
    const videoIndex = provider.portfolio.videos.findIndex(video => video._id.toString() === id);

    let filePath;
    if (imageIndex !== -1) {
      filePath = provider.portfolio.images[imageIndex].url; // Assuming the full URL is stored
      provider.portfolio.images.splice(imageIndex, 1); // Remove the item
    } else if (videoIndex !== -1) {
      filePath = provider.portfolio.videos[videoIndex].url; // Assuming the full URL is stored
      provider.portfolio.videos.splice(videoIndex, 1); // Remove the item
    } else {
      return res.status(404).json({ success: false, message: 'Item not found in portfolio.' });
    }

    // Extract relative file path for Supabase
    const relativePath = filePath.replace('https://dgdqtarnsfrpfwjzmshh.supabase.co/storage/v1/object/public/provider-images/', '');
    console.log(relativePath);
    // Delete the file from Supabase storage
    const { error } = await supabase.storage.from('provider-images').remove([relativePath]);

    if (error) {
      console.error('Error deleting file from Supabase:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete file from storage.' });
    }

    // Save the updated provider data
    await provider.save();

    res.status(200).json({ success: true, message: 'Item deleted successfully.' });
  } catch (error) {
    console.error('Error deleting portfolio item:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};
