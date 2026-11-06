import mongoose from "mongoose";

import Category from "../models/Category.js";
import HttpError from "../utils/httpError.js";
import cloudinary from "../config/cloudinary.js";

// ========================================
// HELPERS
// ========================================

// ========================================
// ADMIN ROLE CHECK
// Only admins can manage categories
// ========================================

const checkAdminRole = (req, next) => {
  if (req.user?.role !== "admin") {
    next(
      new HttpError(
        "Only administrators can manage categories",
        403
      )
    );

    return false;
  }

  return true;
};

// Validate MongoDB ID
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Generate URL-friendly slug
const generateSlug = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Convert form-data string values to booleans
const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }

  return value;
};

// Delete category image from Cloudinary
const deleteCategoryImage = async (publicId) => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Category image deletion failed:", error.message);
  }
};

// ========================================
// CREATE CATEGORY
// POST /api/categories
// ========================================

export const createCategory = async (req, res, next) => {
  try {
    if (!checkAdminRole(req, next)) return;

    const body = req.body || {};

    const {
      name,
      description,
      isActive,
      sortOrder,
    } = body;

    const cleanName = name?.trim();
    const cleanDescription = description?.trim();

    const slug = generateSlug(cleanName || "");

    // Check duplicate category name
    const existingCategory = await Category.findOne({
      name: new RegExp(
        `^${(cleanName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i"
      ),
      isDeleted: false,
    });

    if (existingCategory) {
      return next(new HttpError("Category already exists", 409));
    }

    // Check duplicate slug
    const existingSlug = await Category.findOne({ slug });

    if (existingSlug) {
      return next(new HttpError("Category slug already exists", 409));
    }

    const imageFile = req.file;

    const category = await Category.create({
      name: cleanName,
      slug,
      description: cleanDescription,
      image: imageFile
        ? {
          url: imageFile.path,
          publicId: imageFile.filename,
        }
        : undefined,
      isActive:
        isActive !== undefined
          ? parseBoolean(isActive)
          : true,
      sortOrder:
        sortOrder !== undefined ? Number(sortOrder) : 0,
      createdBy:
        req.user?.user_id ||
        req.user?._id ||
        req.user?.id ||
        null,
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// GET ALL ACTIVE CATEGORIES
// GET /api/categories
// ========================================

export const getAllCategories = async (req, res, next) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 10,
      sort = "sortOrder",
      order = "asc",
    } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.min(
      100,
      Math.max(1, Number(limit) || 10)
    );

    const filter = {
      isActive: true,
      isDeleted: false,
    };

    if (search.trim()) {
      const escapedSearch = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        {
          description: {
            $regex: escapedSearch,
            $options: "i",
          },
        },
      ];
    }

    const allowedSortFields = [
      "name",
      "createdAt",
      "sortOrder",
    ];

    const sortField = allowedSortFields.includes(sort)
      ? sort
      : "sortOrder";

    const sortOrder = order === "desc" ? -1 : 1;

    const [categories, total] = await Promise.all([
      Category.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber),

      Category.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      data: categories,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// GET CATEGORY BY ID
// GET /api/categories/:id
// ========================================

export const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return next(new HttpError("Invalid category ID", 400));
    }

    const category = await Category.findOne({
      _id: id,
      isActive: true,
      isDeleted: false,
    });

    if (!category) {
      return next(new HttpError("Category not found", 404));
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// GET CATEGORY BY SLUG
// GET /api/categories/slug/:slug
// ========================================

export const getCategoryBySlug = async (req, res, next) => {
  try {
    const category = await Category.findOne({
      slug: req.params.slug.toLowerCase(),
      isActive: true,
      isDeleted: false,
    });

    if (!category) {
      return next(new HttpError("Category not found", 404));
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// UPDATE CATEGORY
// PATCH /api/categories/:id
// ========================================

export const updateCategory = async (req, res, next) => {
  try {
    if (!checkAdminRole(req, next)) return;

    const { id } = req.params;
    const body = req.body || {};

    if (!isValidId(id)) {
      return next(new HttpError("Invalid category ID", 400));
    }

    const category = await Category.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!category) {
      return next(new HttpError("Category not found", 404));
    }

    const { name, description, isActive, sortOrder } = body;

    if (name !== undefined) {
      const cleanName = name.trim();

      const duplicate = await Category.findOne({
        _id: { $ne: id },
        name: new RegExp(
          `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i"
        ),
        isDeleted: false,
      });

      if (duplicate) {
        return next(
          new HttpError("Another category already uses this name", 409)
        );
      }

      category.name = cleanName;
      category.slug = generateSlug(cleanName);
    }

    if (description !== undefined) {
      category.description = description.trim();
    }

    if (isActive !== undefined) {
      category.isActive = parseBoolean(isActive);
    }

    if (sortOrder !== undefined) {
      const parsedSortOrder = Number(sortOrder);

      if (!Number.isFinite(parsedSortOrder) || parsedSortOrder < 0) {
        return next(new HttpError("Invalid sort order", 400));
      }

      category.sortOrder = parsedSortOrder;
    }

    // Replace image only when a new image is uploaded
    if (req.file) {
      const oldPublicId = category.image?.publicId;

      category.image = {
        url: req.file.path,
        publicId: req.file.filename,
      };

      await category.save();

      if (oldPublicId) {
        await deleteCategoryImage(oldPublicId);
      }
    } else {
      await category.save();
    }

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// ACTIVATE / DEACTIVATE CATEGORY
// PATCH /api/categories/:id/status
// ========================================

export const updateCategoryStatus = async (req, res, next) => {
  try {
    if (!checkAdminRole(req, next)) return;

    const { id } = req.params;
    const { isActive } = req.body || {};

    if (!isValidId(id)) {
      return next(new HttpError("Invalid category ID", 400));
    }

    if (typeof parseBoolean(isActive) !== "boolean") {
      return next(
        new HttpError("isActive must be true or false", 400)
      );
    }

    const category = await Category.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isActive: parseBoolean(isActive) } },
      { new: true, runValidators: true }
    );

    if (!category) {
      return next(new HttpError("Category not found", 404));
    }

    res.status(200).json({
      success: true,
      message: `Category ${category.isActive ? "activated" : "deactivated"
        } successfully`,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// DELETE CATEGORY (SOFT DELETE)
// DELETE /api/categories/:id
// ========================================

export const deleteCategory = async (req, res, next) => {
  try {
    if (!checkAdminRole(req, next)) return;

    const { id } = req.params;

    if (!isValidId(id)) {
      return next(new HttpError("Invalid category ID", 400));
    }

    const category = await Category.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!category) {
      return next(new HttpError("Category not found", 404));
    }

    // Do not delete categories that are still assigned to tours
    // Import Tour and check usage here if your Tour model is available.

    category.isDeleted = true;
    category.isActive = false;

    await category.save();

    if (category.image?.publicId) {
      await deleteCategoryImage(category.image.publicId);
    }

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
