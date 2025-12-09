import User from "../models/User.js";

export const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ 
        message: "Acceso denegado. Se requieren permisos de administrador." 
      });
    }

    // ACTIVACIÓN POR ADMIN - COMENTADO: Se permite acceso de admin sin verificar isActive
    // if (!user.isActive) {
    //   return res.status(403).json({ 
    //     message: "Tu cuenta está inactiva." 
    //   });
    // }

    next();
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

