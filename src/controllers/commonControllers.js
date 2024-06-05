const dbConn = require("../configs/database")
const jwt = require("jsonwebtoken");
const bcrypt = require('bcrypt');


require("dotenv").config();

// function to query database
function dbQuery(query,param = []){
    return new Promise((resolve,reject)=>{
        dbConn.query(query,param,(err,res)=>{
            if (err) return reject(err);
            resolve(res)
        })
    })
}
 
// function to generate JWT
function generateJWT(user){
    // jwt payload
    data={
        uuid : user.UUID,
        email : user.EMAIL, 
        name : user.NAME,
        role : user.ROLE
    };
    return jwt.sign({data},process.env.SECRET_KEY,{expiresIn:"1d"});
}

function saltNhash(password){
    const salt = bcrypt.genSaltSync(10)
    password = bcrypt.hash(password,salt);
    return password
}

async function newUser(req,res){
    
    const name = req.body.name;
    const password=await saltNhash(req.body.password)
    const email = req.body.email;
    const phn_no = req.body.phn_no;
    let result = await dbQuery("SELECT * FROM USER WHERE EMAIL=?",[email]);
    if (result.length==0){
        result = await dbQuery("INSERT INTO USER VALUES(NULL,?,?,?,?,?)",[name,email,phn_no,password,'user']);
        return logging(req,res)
    }
    return res.send("This email ID already exists")
    
}


// login logic  to generate jwt
async function logging(req,res){
    let inp_email=req.body.email.trim().toLowerCase();
    let inp_password=req.body.password.trim();
    let result = await dbQuery(`SELECT * FROM USER WHERE EMAIL=?;`,[inp_email])

    if (result.length ==1 && bcrypt.compare(inp_password,result[0]["PASSWORD"]) ){
        const user=result[0];
        const token=generateJWT(user); // 'user' is the complete user object from db
        res.cookie("token",token,{httpOnly:true});
        res.redirect("/");
    }
    
}

// book catalog logic
async function getBookCatalog(req, res){
    let dataset = await dbQuery("SELECT * FROM BOOKS;");
    const role =req.user.role;
    const books_per_page=5;
    let no_of_pages=Math.ceil(dataset.length/books_per_page);
    let data,page,start_index;

    if (req.query.page && Number.isInteger(Number(req.query.page))){
        page=Number(req.query.page)
        if (page<=0) page=1;
        else if (page>no_of_pages) page=no_of_pages;
    }
    else page=1;
    let search=req.query.search;
    if (search){
        search= search.trim()
        dataset=dataset.filter((val)=>{return (val.NAME.toLowerCase().includes(search.toLowerCase()))})
        no_of_pages=Math.ceil(dataset.length/books_per_page)
    }
    
    start_index=(page-1)*books_per_page;
    const end_index=page*books_per_page
    data = dataset.slice(start_index,end_index)
        
    return res.render("bookCatalog.ejs",{data : data , page : page , books_per_page : books_per_page , no_of_pages : no_of_pages , start_index : start_index , search : search, role : role})
}

// book page logic
async function getBookPage(req,res,buid){
    let book = await dbQuery(`SELECT * FROM BOOKS WHERE BUID=?;`,[buid]);
    book=book[0];
    role=req.user.role;
    res.render("bookPage.ejs",{book:book,role:role});
}

// creates a pending checkin req for users and instantly resolves for admins 
async function makeCheckoutReq(req,res){
    const buid=parseInt(req.body.buid)
    if (isNaN(buid)){
        res.send("Invalid BUID parameter recieved")
    }
    const uuid=req.user.uuid;
    const result =await dbQuery("SELECT * FROM BOOKS WHERE BUID=?",[buid]) 
    if (result[0]["CHECKIN"]==0 || result.length===0){
        return res.redirect("/");
    }

    const result2=await dbQuery("INSERT INTO PENDING_REQUESTS VALUES(?,?,0)",[uuid,buid]) // 0 for checkout, 1 for checkin

    if (req.user.role==="admin"){            // admins dont need permission   // request will go to pending list but will be instantly resolved in case of admins
        return res.redirect(`/admin/approve/${uuid}/${buid}`);
    }

    res.redirect("/pending")
}

// creates a pending checkin req for users and instantly resolves for admins
async function makeCheckinReq(req,res){
    const buid=parseInt(req.body.buid)
    const uuid=req.user.uuid;

    if (isNaN(buid)){
        res.send("Invalid BUID parameter recieved")
    }

    const result =await dbQuery("SELECT * FROM BORROWING_HISTORY WHERE UUID=? AND BUID=? AND CHECKIN_DATE IS NULL;",[uuid,buid])
    if (result.length!=1){
        res.send("You can not create a checkin request for someoone else!")
    }
    const result2 =await dbQuery("INSERT INTO PENDING_REQUESTS VALUES(?,?,1);",[uuid,buid])  // 0 for checkout, 1 for checkin

    if (req.user.role==="admin"){            // admins dont need permission // request will go to pending list but will be instantly resolved in case of admins
        return res.redirect(`/admin/approve/${uuid}/${buid}`);
    }

    res.redirect("/pending")
}

// 
async function getCvtAdmin(req,res){
    const role = req.user.role;
    const uuid= req.user.uuid;
    let applied= false,users=[];  // is request already made
    const result = await dbQuery("SELECT * FROM ADMIN_REQUESTS WHERE UUID=?",[uuid])
    
    if(role==="admin"){
        users = await dbQuery("SELECT UUID, USER.NAME, USER.PHN_NO FROM ADMIN_REQUESTS NATURAL JOIN USER;")
    }
    if (result.length==1){
        applied = true;
    }
     
    data={
        role : role,
        applied : applied,
        uuid : uuid,
        users : users
    }
    res.render("cvtAdmin.ejs",data)
}

async function postCvtAdmin(req,res){
    const role = req.user.role;
    const uuid=req.user.uuid;
    if(role==="admin"){
        let target_uuid=req.body.approve ;
        let target_uuid2=req.body.approve || req.body.deny;
        let result = await dbQuery("SELECT * FROM ADMIN_REQUESTS WHERE UUID=?;",[target_uuid2])
        if (result.length!=1){
            return res.send("You can't promote someone who hasn't made a request!")
        }
        else{
            if (target_uuid){    // if approve undefinded then it must be a deny
                result = await dbQuery("DELETE FROM ADMIN_REQUESTS WHERE UUID=?;",[target_uuid])
                result = await dbQuery("UPDATE USER SET ROLE = ? WHERE UUID = ?;",["admin",target_uuid])
            }
            else{
                target_uuid=req.body.deny
                result = await dbQuery("DELETE FROM ADMIN_REQUESTS WHERE UUID=?;",[target_uuid])
            }
        }
    }
    if(role==="user"){
        let result = await dbQuery("SELECT * FROM ADMIN_REQUESTS WHERE UUID=?",[uuid])
        if (result.length!=0){
            return res.send("Request already made!")
        }
        result = await dbQuery("INSERT INTO ADMIN_REQUESTS VALUES(?)",[uuid]);
    }
    
    res.redirect("/")
}
// common get all book pending requests
async function getPending(req,res){
    const role=req.user.role;
    const uuid=req.user.uuid;
    let checkins=[],checkouts=[];

    if (role==="admin"){
        let result= await dbQuery(`SELECT USER.UUID, BOOKS.BUID , USER.NAME AS USER_NAME,BOOKS.NAME AS BOOK_NAME,PENDING_REQUESTS.TYPE FROM PENDING_REQUESTS JOIN USER ON USER.UUID = PENDING_REQUESTS.UUID JOIN BOOKS ON PENDING_REQUESTS.BUID=BOOKS.BUID;`);
        result.forEach(val =>{
            if (val.TYPE===1){
                checkins.push(val);
            }
            else{
                checkouts.push(val);
            }
        });   
    }
    if (role==="user"){
        let result= await dbQuery(`SELECT USER.UUID, BOOKS.BUID , USER.NAME AS USER_NAME,BOOKS.NAME AS BOOK_NAME,PENDING_REQUESTS.TYPE FROM PENDING_REQUESTS JOIN USER ON USER.UUID = PENDING_REQUESTS.UUID JOIN BOOKS ON PENDING_REQUESTS.BUID=BOOKS.BUID WHERE USER.UUID=? ;`,[uuid]);
        result.forEach(val =>{
            if (val.TYPE===1){
                checkins.push(val);
            }
            else{
                checkouts.push(val);
            }
        });   
    }

    data={
        role : role,
        checkins : checkins,
        checkouts : checkouts
    };
    res.render("pendingReq.ejs",data);
}

// refreshhes the user's jwt token 
async function refreshToken(req,res){
    const uuid=req.user.uuid;
    let user = await dbQuery("SELECT * FROM USER WHERE UUID=?",[uuid]);
    let data={
        UUID : user[0].UUID,
        EMAIL : user[0].EMAIL, 
        NAME : user[0].NAME,
        ROLE : user[0].ROLE
    }
    const cookies = req.cookies;
    if (cookies && cookies.token){
        const og_token=cookies.token;
        const new_token=generateJWT(data); // 'user' is the complete user object from db
        
        if (og_token != new_token){
            res.clearCookie("token");
            res.cookie("token",new_token,{httpOnly:true});
            return res.redirect("/");
        }
        res.redirect("/cvt_admin");
    }
    

}





module.exports={
    getBookCatalog,
    logging,
    getBookPage,
    makeCheckinReq,
    makeCheckoutReq,
    getCvtAdmin,
    postCvtAdmin,
    refreshToken,
    newUser,
    dbQuery,
    getPending,
    saltNhash
};