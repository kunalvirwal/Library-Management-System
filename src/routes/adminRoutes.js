const express = require("express");
const router = express.Router();
const controllers = require("../controllers/adminControllers")
const middleware = require("../utils/middlewares") 
require("dotenv").config();

//admin dashboard route
router.get("/admin/dashboard",middleware.authenticate_token,middleware.authorize_user,middleware.isAdmin,(req,res)=>{
    controllers.getAdminDashData(req,res);
});

//admin edit book route
router.get("/admin/editbook/:buid",middleware.authenticate_token,middleware.authorize_user,middleware.isAdmin,(req,res)=>{
    const parseid=parseInt(req.params.buid)
    if(isNaN(parseid)){
        return res.send("Incorrect route!")
    }
    controllers.editBook(req,res,parseid);
});

// admin edit book save changes route
router.post("/admin/editbook/:buid",middleware.authenticate_token,middleware.authorize_user,middleware.isAdmin,(req,res)=>{
    const parseid=parseInt(req.params.buid);
    if(isNaN(parseid)){
        return res.send("Incorrect route!");
    }
    controllers.saveBookEditChanges(req,res,parseid);
})
// create a new book route
router.get("/admin/addbook",middleware.authenticate_token,middleware.authorize_user,middleware.isAdmin,(req,res)=>{
    res.render("createBook.ejs");
})

// admin create book logic route
router.post("/admin/addbook",middleware.authenticate_token,middleware.authorize_user,middleware.isAdmin,(req,res)=>{
    controllers.newBook(req,res);
})

// delete book route
router.get("/admin/deletebook/:buid",middleware.authenticate_token,middleware.authorize_user,middleware.isAdmin,(req,res)=>{
    const parseid=parseInt(req.params.buid);

    if(isNaN(parseid)){
        return res.send("Incorrect route!");
    }
    controllers.deleteBook(req,res,parseid);
})

// common approve link but operated by admin
router.get("/admin/approve/:uuid/:buid",middleware.authenticate_token,middleware.authorize_user,middleware.isAdmin,(req,res)=>{
    const parsebuid=parseInt(req.params.buid);
    const parseuuid=parseInt(req.params.uuid);

    if(isNaN(parsebuid) || isNaN(parseuuid)){
        return res.send("Incorrect route!");
    }
    controllers.approve(req,res,parseuuid,parsebuid);
});

// common deny link but operated by admin
router.get("/admin/deny/:uuid/:buid",middleware.authenticate_token,middleware.authorize_user,middleware.isAdmin,(req,res)=>{
    const parsebuid=parseInt(req.params.buid);
    const parseuuid=parseInt(req.params.uuid);
    
    if(isNaN(parsebuid) || isNaN(parseuuid)){
        return res.send("Incorrect route!");
    }
    controllers.deny(req,res,parseuuid,parsebuid);
});

module.exports = router;