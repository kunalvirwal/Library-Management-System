const jwt = require("jsonwebtoken");
const controllers = require("../controllers/commonControllers")

// decodes the token if present on each request 
function authenticate_token(req, res, next) {
    const unprotectedPaths = ["/signup", "/newUser", "/login"]
    if (!(unprotectedPaths.includes(req.path))) {
        const cookies = req.cookies;
        if (cookies && cookies.token) {

            try {
                const payload = jwt.verify(cookies.token, process.env.SECRET_KEY);
                req.user = payload.data;

            } catch (err) {
                res.clearCookie("token");
                return res.status(403).redirect("/")  // Invalid JWT token
            }

        }
        else {
            req.user = undefined;
        }
    }

    next();
}

// verifies the jwt payload
function authorize_user(req, res, next) {
    const unprotectedPaths = ["/signup", "/newUser", "/login", "/"]
    if (!(unprotectedPaths.includes(req.path))) {
        if (req.user && req.user.uuid && req.user.email && req.user.role && req.user.name) {
            next();
        }
        else {
            res.clearCookie("token");
            res.user = undefined;
            return res.status(403).redirect("/");  // User not authenticated, Can't access route!
        }
    } else {
        next();
    }
}

//checks if admin
function isAdmin(req, res, next) {
    if (req.user.role === "admin") next();
    else {
        return res.status(403).redirect("/");  // User not authorized, Can't access route!
    }
}

//checks if user
function isUser(req, res, next) {
    if (req.user.role === "user") next();
    else {
        return res.status(403).redirect("/");  // User not authorized, Can't access route!
    }
}

//create Admin middleware
async function createAdmin(req, res, next) {
    let result = await controllers.dbQuery("SELECT * FROM USER WHERE ROLE=?", ["admin"])
    if (result.length == 0) {
        AdminPassword = "A"
        AdminPassword = await controllers.saltNhash(AdminPassword)
        result = await controllers.dbQuery("INSERT INTO USER VALUES(1,'admin','admin@sdslabs.com','9999999999',?,'admin',NULL);", [AdminPassword])  // ADMIN_REQUESTS VALUE OF ADMINS IS NULL
    }
    next()

}

//sanitise a query
function sanitise(query) {
    wrong_characters = ["\'", "\"", "\`", "--", "=", " ", "(", ")", ",",];

    wrong_characters.forEach((val) => {
        if (query.includes(val)) {
            return false;
        }
    });

    return true;
}

//sql injection sanition
function sanitiseEmail(req, res, next) {
    req.body.email = req.body.email.trim().toLowerCase();
    parts = req.body.email.split("@")
    let valid = true;
    if (parts.length == 2) {
        valid = sanitise(parts[1]);
    }
    else {
        valid = false;
    }

    if (valid) {
        next();
    }
    else {
        res.status(400).redirect("/"); // Wrong input details, can't login
    }
}

module.exports = {
    authenticate_token,
    authorize_user,
    createAdmin,
    isAdmin,
    isUser,
    sanitiseEmail,
    sanitise
};