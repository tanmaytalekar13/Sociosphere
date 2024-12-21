const express = require("express");
const { Category, categoryValidationSchema } = require("../models/category"); // Import the Category model and validation schema
const Joi = require("joi");
const router = express.Router();
const upload = require("../config/multer");
const { validateAdmin } = require("../middlewares/admin");
const { Provider } = require("../models/provider");
const authenticateJWT=require("../middlewares/user")
const {User} = require("../models/user");
const supabase = require("../config/supabase");

// Middleware to validate the category
const validateCategory = async (req, res, next) => {
  const { error } = categoryValidationSchema.validate(req.body);
  if (error) {
    return res.status(400).send(error.details[0].message); // Send error message if validation fails
  }
  next(); // Proceed to the next middleware or route handler
};

router.post(
  "/create",
  upload.single("image"), // Use the Multer upload middleware
  validateCategory,
  async (req, res) => {
    const { name, description } = req.body;

    try {
      // Check if the category already exists
      const isCategory = await Category.findOne({ name });
      if (isCategory) return res.status(400).send("Category already exists");

      let imageUrl = null;

      // Upload image to Supabase Storage if a file is provided
      if (req.file) {
        const fileName = `${Date.now()}_${req.file.originalname}`; // Unique file name
        const { data, error } = await supabase.storage
          .from("categories") // Supabase bucket name
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
          });

        if (error) throw error;

        // Generate the public URL for the uploaded image
        const { data: publicUrl } = supabase.storage
          .from("categories")
          .getPublicUrl(fileName);

        imageUrl = publicUrl.publicUrl; // Set the image URL
      }

      // Create a new category in MongoDB
      const newCategory = await Category.create({
        name,
        description,
        image: imageUrl, // Store the image URL
      });

      // Redirect or respond with success
      res.redirect("/admin/dashboard");
    } catch (error) {
      console.error("Error in creating category:", error.message);
      res.status(500).send("Error in creating category");
    }
  }
);


router.post(
  "/update",
  upload.single("image"), // Multer middleware for single file upload
  validateAdmin,
  async (req, res) => {
    try {
      const { currentName, updatedName, updatedDescription } = req.body;

      // Find the existing category based on currentName
      const category = await Category.findOne({ name: currentName });
      if (!category) {
        return res.status(404).send("Category not found");
      }

      // Check if updated name already exists in the database
      if (updatedName && updatedName !== currentName) {
        const existingCategory = await Category.findOne({ name: updatedName });
        if (existingCategory) {
          return res.status(400).send("Category with that name already exists");
        }
      }

      // Update fields
      if (updatedName) category.name = updatedName;
      if (updatedDescription) category.description = updatedDescription;

      // Update image if a new file is uploaded
      if (req.file) {
        const fileName = `${Date.now()}_${req.file.originalname}`; // Unique file name

        // Upload the image to Supabase Storage
        const { data, error } = await supabase.storage
          .from("categories") // Bucket name in Supabase
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true, // Replace the file if it already exists
          });

        if (error) throw error;

        // Generate the public URL for the uploaded image
        const { data: publicUrl } = supabase.storage
          .from("categories")
          .getPublicUrl(fileName);

        category.image = publicUrl.publicUrl; // Update the image URL in the database
      }

      // Save the updated category
      await category.save();

      // Redirect to the admin dashboard after successful update
      res.redirect("/admin/dashboard");
    } catch (error) {
      console.error("Error updating category:", error.message);
      res.status(400).send("Error updating category");
    }
  }
);

router.post("/delete", validateAdmin, async function (req, res) {
  try {
    const { name } = req.body; // Get the name of the category from the request body

    // Find the category by its name and delete it
    const deleteCategory = await Category.findOneAndDelete({ name: name });

    if (!deleteCategory) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.redirect("/admin/dashboard");
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// This route should come after the '/all' route
router.get("/:id", authenticateJWT, async function (req, res) {
  try {
    const userEmail = req.user.email; 

    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      return res.status(404).send('User not found');
    }

    const userName = user.name;
    const categoryId = req.params.id;
    const category = await Category.findById(categoryId);

    // Get the search term from the query string
    const searchTerm = req.query.search || "";

    // Fetch providers with filtering based on category and status "approved"
    let providers = await Provider.find({ 
      category: categoryId,
      status: "approved"
    });

    // Filter providers further based on the search term
    if (searchTerm) {
      providers = providers.filter(provider =>
        provider.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        provider.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Map providers to include image if available
    providers = providers.map((provider) => {
      return {
        ...provider._doc,
        image: provider.image || null, // Use the URL directly if it exists
      };
    });

    // Fetch categories with filtering based on the search term
    const categories = await Category.find({
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
      ],
    });

    if (!categories || categories.length === 0) {
      return res.render("index", { categories: [], searchTerm, userName });
    }

    res.render("user_provider", {
      category,
      providers,
      categories,
      searchTerm,
      userName
    });
  } catch (err) {
    console.error("Error fetching category or providers:", err);
    res.status(500).send("Internal Server Error");
  }
});
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const userEmail = req.user.email;

    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Get the user's name
    const userName = user.name;
    const searchTerm = req.query.search || "";

    // Perform a case-insensitive search in both the 'name' and 'description' fields
    const categories = await Category.find({
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } }
      ],
    });

    // If no categories are found, render the index page with an empty array
    if (!categories || categories.length === 0) {
      return res.render("index", { categories: [], searchTerm });
    }

    // Render the index page with the found categories and search term
    res.render("category", { categories, searchTerm, userName });

  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).send("Server error");
  }
});


  
module.exports = router;
