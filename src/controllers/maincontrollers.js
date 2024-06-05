const dbConn = require("../configs/database")
const jwt = require("jsonwebtoken");
const bcrypt = require('bcrypt');


require("dotenv").config();

// function to query database
function db_query(query,param = []){
    return new Promise((resolve,reject)=>{
        dbConn.query(query,param,(err,res)=>{
            if (err) return reject(err);
            resolve(res)
        })
    })
}
 
// function to generate JWT
function generate_jwt(user){
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
    let result = await db_query("SELECT * FROM USER WHERE EMAIL=?",[email]);
    console.log(password)
    if (result.length==0){
        result = await db_query("INSERT INTO USER VALUES(NULL,?,?,?,?,?)",[name,email,phn_no,password,'user']);
        return logging(req,res)
    }
    return res.send("This email ID already exists")
    
}


// login logic  to generate jwt
async function logging(req,res){
    
    let inp_email=req.body.email.trim().toLowerCase();
    let inp_password=req.body.password.trim();
    let result = await db_query(`SELECT * FROM USER WHERE EMAIL=?;`,[inp_email])

    if (result.length ==1 && bcrypt.compare(inp_password,result[0]["PASSWORD"]) ){
        const user=result[0];
        const token=generate_jwt(user); // 'user' is the complete user object from db
        res.cookie("token",token,{httpOnly:true});
        res.redirect("/");
    }
    
}

// book catalog logic
async function getBookCatalog(req, res){
    let dataset = await db_query("SELECT * FROM BOOKS;");
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
        
    return res.render("book_catalog.ejs",{data : data , page : page , books_per_page : books_per_page , no_of_pages : no_of_pages , start_index : start_index , search : search, role : role})
}

// book page logic
async function getBookPage(req,res,buid){
    let book = await db_query(`SELECT * FROM BOOKS WHERE BUID=?;`,[buid]);
    book=book[0];
    role=req.user.role;
    res.render("book_page.ejs",{book:book,role:role});
}

// creates a pending checkin req for users and instantly resolves for admins 
async function makeCheckoutReq(req,res){
    const buid=parseInt(req.body.buid)
    if (isNaN(buid)){
        res.send("Invalid BUID parameter recieved")
    }
    const uuid=req.user.uuid;
    const result =await db_query("SELECT * FROM BOOKS WHERE BUID=?",[buid]) 
    if (result[0]["CHECKIN"]==0 || result.length===0){
        return res.redirect("/");
    }

    const result2=await db_query("INSERT INTO PENDING_REQUESTS VALUES(?,?,0)",[uuid,buid]) // 0 for checkout, 1 for checkin

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

    const result =await db_query("SELECT * FROM BORROWING_HISTORY WHERE UUID=? AND BUID=? AND CHECKIN_DATE IS NULL;",[uuid,buid])
    if (result.length!=1){
        res.send("You can not create a checkin request for someoone else!")
    }
    const result2 =await db_query("INSERT INTO PENDING_REQUESTS VALUES(?,?,1);",[uuid,buid])  // 0 for checkout, 1 for checkin

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
    const result = await db_query("SELECT * FROM ADMIN_REQUESTS WHERE UUID=?",[uuid])
    
    if(role==="admin"){
        users = await db_query("SELECT UUID, USER.NAME, USER.PHN_NO FROM ADMIN_REQUESTS NATURAL JOIN USER;")
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
        let result = await db_query("SELECT * FROM ADMIN_REQUESTS WHERE UUID=?;",[target_uuid2])
        if (result.length!=1){
            return res.send("You can't promote someone who hasn't made a request!")
        }
        else{
            if (target_uuid){    // if approve undefinded then it must be a deny
                result = await db_query("DELETE FROM ADMIN_REQUESTS WHERE UUID=?;",[target_uuid])
                result = await db_query("UPDATE USER SET ROLE = ? WHERE UUID = ?;",["admin",target_uuid])
            }
            else{
                target_uuid=req.body.deny
                result = await db_query("DELETE FROM ADMIN_REQUESTS WHERE UUID=?;",[target_uuid])
            }
        }
    }
    if(role==="user"){
        let result = await db_query("SELECT * FROM ADMIN_REQUESTS WHERE UUID=?",[uuid])
        if (result.length!=0){
            return res.send("Request already made!")
        }
        result = await db_query("INSERT INTO ADMIN_REQUESTS VALUES(?)",[uuid]);
    }
    
    res.redirect("/")
}

async function refresh_token(req,res){
    const uuid=req.user.uuid;
    let user = await db_query("SELECT * FROM USER WHERE UUID=?",[uuid]);
    let data={
        UUID : user[0].UUID,
        EMAIL : user[0].EMAIL, 
        NAME : user[0].NAME,
        ROLE : user[0].ROLE
    }
    const cookies = req.cookies;
    if (cookies && cookies.token){
        const og_token=cookies.token;
        const new_token=generate_jwt(data); // 'user' is the complete user object from db
        
        if (og_token != new_token){
            res.clearCookie("token");
            res.cookie("token",new_token,{httpOnly:true});
            return res.redirect("/");
        }

    }
    res.redirect("/cvt_admin");





    
    
    
    

}




//*********************************************************************************ADMIN*********************************************************************************/

// admin dashboard logic
async function getAdminDashData(req,res){
    let name=""; 
    for(let i of req.user.name.split(" ")){ 
        name+= (i.charAt(0).toUpperCase() + i.slice(1)); 
    }; 
    
    //use books db to get no of books
    let result= await db_query("SELECT COUNT(*) FROM BOOKS;");
    const no_of_books=result[0]["COUNT(*)"];
    
    //checkedout books
    result= await db_query("SELECT COUNT(*) FROM BOOKS WHERE CHECKIN=0;");
    const checked_out=result[0]["COUNT(*)"];
    
    // no of users
    result= await db_query("SELECT COUNT(*) FROM USER;");
    let no_of_users=result[0]["COUNT(*)"];

    //pending checkin/out requests + admin requests
    let pending_requests=0
    result= await db_query("SELECT COUNT(*) FROM PENDING_REQUESTS;");
    pending_requests+=Number(result[0]["COUNT(*)"]);
    result= await db_query("SELECT COUNT(*) FROM ADMIN_REQUESTS;");
    pending_requests+=Number(result[0]["COUNT(*)"]);
    
    const uuid=req.user.uuid
    let books =await db_query("SELECT * FROM BORROWING_HISTORY NATURAL JOIN BOOKS WHERE UUID=? AND CHECKIN_DATE IS NULL;",[uuid])
    ///////////////////////////////////////////use borrowing history for implementing overdues
    overdue=1

    return res.render("admin_dash.ejs",{
        name : name,
        no_of_books : no_of_books,
        checked_out : checked_out,
        no_of_users : no_of_users,
        pending_requests : pending_requests,
        overdue : overdue,
        books:books
    });
}

// admin edit book page logic
async function editBook(req,res,buid){
    let book = await db_query(`SELECT * FROM BOOKS WHERE BUID=?;`,[buid]);
    book=book[0];
    res.render("edit_book_page.ejs",{book:book});
}

// admin edit book logic
async function saveBookEditChanges(req,res,buid){
    // console.log(req.body)
    const inp_name=req.body.name;
    const inp_description=req.body.description;
    if (inp_description.length>2000){
        return res.send("Can't update details: Description too long!")
    }
    if (inp_name.length>50){
        return res.send("Can't update details: Name too long!")
    }
    let result= await db_query(`UPDATE BOOKS SET NAME=? WHERE BUID=?`,[inp_name,buid]);
    result=await db_query(`UPDATE BOOKS SET DESCRIPTION=? WHERE BUID=?`,[inp_description,buid]);
    res.status(200).redirect(`/books/${buid}`);
}

// admin create new book
async function newBook(req,res){
    const inp_name=req.body.name;
    const inp_description=req.body.description;
    if (inp_description.length>2000){
        return res.send("Can't update details: Description too long!")
    }
    if (inp_name.length>50){
        return res.send("Can't update details: Name too long!")
    }
    let result= await db_query(`INSERT INTO BOOKS VALUES(NULL,?,?,1)`,[inp_name,inp_description]);
    res.status(200).redirect(`/books`);
}

//admin delete book
async function deleteBook(req,res,buid){
    
    let result= await db_query(`DELETE FROM BOOKS WHERE BUID=?`,[buid]);
    res.status(200).redirect(`/books`);
}

// common get all book pending requests
async function getPending(req,res){
    const role=req.user.role;
    const uuid=req.user.uuid;
    let checkins=[],checkouts=[];

    if (role==="admin"){
        let result= await db_query(`SELECT USER.UUID, BOOKS.BUID , USER.NAME AS USER_NAME,BOOKS.NAME AS BOOK_NAME,PENDING_REQUESTS.TYPE FROM PENDING_REQUESTS JOIN USER ON USER.UUID = PENDING_REQUESTS.UUID JOIN BOOKS ON PENDING_REQUESTS.BUID=BOOKS.BUID;`);
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
        let result= await db_query(`SELECT USER.UUID, BOOKS.BUID , USER.NAME AS USER_NAME,BOOKS.NAME AS BOOK_NAME,PENDING_REQUESTS.TYPE FROM PENDING_REQUESTS JOIN USER ON USER.UUID = PENDING_REQUESTS.UUID JOIN BOOKS ON PENDING_REQUESTS.BUID=BOOKS.BUID WHERE USER.UUID=? ;`,[uuid]);
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
    res.render("pending_req.ejs",data);
}

async function approve(req,res,uuid,buid){
    // checkout approval reqires availablity of book and consecutive checkout entry in pending_requests 
    // checkin approval reqires unavailablity of book and consecutive checkin entry in pending_requests     
    
    const result=await db_query("SELECT * FROM BOOKS WHERE BUID=?",[buid])
    
    if (result.length!=1){
        return res.send("Incorrect BUID parameter!");
    }
    if (result[0]["CHECKIN"]==0){         // checkin approval
        let result2 = await db_query("SELECT * FROM PENDING_REQUESTS WHERE UUID=? AND BUID=?;",[uuid,buid]);
        if (result2.length==1 && result2[0]["TYPE"]==1){
            result2 = await db_query("DELETE FROM PENDING_REQUESTS WHERE UUID=? AND BUID=?;",[uuid,buid])
            result2 = await db_query("SELECT * FROM BORROWING_HISTORY WHERE UUID=? AND BUID=? AND CHECKIN_DATE IS NULL ",[uuid,buid])
            const d=new Date();
            let date=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+(d.getDate());
            result2 = await db_query("UPDATE BORROWING_HISTORY SET CHECKIN_DATE=? WHERE UUID=? AND BUID=? AND CHECKOUT_DATE=? ",[date,uuid,buid,result2[0]["CHECKOUT_DATE"]])
            result2= await db_query("UPDATE BOOKS SET CHECKIN=1 WHERE BUID=?;",[buid])
        }
    }
    if (result[0]["CHECKIN"]==1){       // checkout approval
        let result2 = await db_query("SELECT * FROM PENDING_REQUESTS WHERE UUID=? AND BUID=?;",[uuid,buid]);
        if (result2.length==1 && result2[0]["TYPE"]==0){
            result2 = await db_query("DELETE FROM PENDING_REQUESTS WHERE UUID=? AND BUID=?;",[uuid,buid])
            const d=new Date();
            let date=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+(d.getDate());
            result2 = await db_query("INSERT INTO BORROWING_HISTORY VALUES(?,?,?,NULL)",[uuid,buid,date])
            result2= await db_query("UPDATE BOOKS SET CHECKIN=0 WHERE BUID=?;",[buid])
        }
    }

    const role=req.user.role;

    if (role==="admin"){
        return res.redirect("/")
    }
    res.redirect("/pending")
}

async function deny(req,res,uuid,buid){////////////////////////////////////////////////////////////////////////////////
    let result = await db_query("DELETE FROM PENDING_REQUESTS WHERE UUID=? AND BUID=?;",[uuid,buid])
    res.redirect("/pending")
}


//**********************************************************************************USER*********************************************************************************/


// user dashboard logic
async function getUserData(req,res){
    
    const uuid=req.user.uuid
    let result =await db_query("SELECT * FROM BORROWING_HISTORY NATURAL JOIN BOOKS WHERE UUID=? AND CHECKIN_DATE IS NULL;",[uuid])
    let result2=await db_query("SELECT * FROM PENDING_REQUESTS WHERE UUID=? AND TYPE=1",[uuid])
    result.forEach(val => {
        val.req=false;
        for (let index = 0; index < result2.length; index++) {
            const ele = result2[index];
            if (ele.BUID==val.BUID){
                val.req=true;
                break;
            }
        }     
    });

    data={
        name:req.user.name,
        books:result,
    };

    res.render("user_dash.ejs",data);
}







module.exports={
    getAdminDashData,
    getBookCatalog,
    logging,
    getBookPage,
    editBook,
    saveBookEditChanges,
    getUserData,
    makeCheckinReq,
    makeCheckoutReq,
    getPending,
    approve,
    deny,
    getCvtAdmin,
    postCvtAdmin,
    refresh_token,
    newBook,
    deleteBook,
    newUser,
    db_query,
    saltNhash
};