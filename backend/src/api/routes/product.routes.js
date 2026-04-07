/**
 * electron/src/api/routes/product.routes.js
 * ──────────────────────────────────────────
 * Product CRUD endpoints
 */

const ProductService = require('../../services/product.service');

module.exports = {
    getAll: async (req, res) => {
        try {
            const filters = req.query;
            const products = await ProductService.getAll(filters);
            res.json(products);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    getById: async (req, res) => {
        try {
            const product = await ProductService.getById(req.params.id);
            if (!product) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }
            res.json(product);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    getByBarcode: async (req, res) => {
        try {
            const product = await ProductService.getByBarcode(req.params.barcode);
            res.json(product || null);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    create: async (req, res) => {
        try {
            const result = await ProductService.create(req.body);
            res.json(result);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    update: async (req, res) => {
        try {
            const result = await ProductService.update(req.params.id, req.body);
            res.json(result);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    delete: async (req, res) => {
        try {
            const result = await ProductService.softDelete(req.params.id);
            res.json(result);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    saveImage: async (req, res) => {
        try {
            const { productId, imageData, extension } = req.body;
            const result = await ProductService.saveImage(productId, imageData, extension);
            res.json(result);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    getImage: async (req, res) => {
        try {
            const image = await ProductService.getImage(req.params.path);
            res.json({ success: true, image });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    bulkImport: async (req, res) => {
        try {
            const { filePath } = req.body;
            const result = await ProductService.bulkImport(filePath);
            res.json(result);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    },

    getLowStock: async (req, res) => {
        try {
            const products = await ProductService.getLowStock();
            res.json(products);
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};
