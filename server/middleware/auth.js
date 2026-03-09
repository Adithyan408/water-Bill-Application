import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'waterbill-super-secret-key-123';

export const authMiddleware = (roles = []) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return (req, res, next) => {
        try {
            // Get token from header
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ message: 'Authorization denied, no token' });
            }

            const token = authHeader.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;

            // Check role if roles are specified
            if (roles.length && !roles.includes(req.user.role)) {
                return res.status(403).json({ message: 'Forbidden, insufficient permissions' });
            }

            next();
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired' });
            }
            res.status(401).json({ message: 'Invalid token' });
        }
    };
};
