const dbConn = require("../configs/database")
const jwt = require("jsonwebtoken");


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
 
// function to geenerate JWT
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



// login logic  to generate jwt
async function logging(req,res){
    //////////////////////////////////////////////////////////////////////////hash to compair incoming password
    
    // hashing password
    ///////////////////////////////////////////////////////////////////////// sql sanitation
    let inp_email=req.body.email.trim().toLowerCase();
    let inp_password=req.body.password.trim();
    let result = await db_query(`SELECT * FROM USER WHERE EMAIL=? AND BINARY PASSWORD=?;`,[inp_email,inp_password])
    if (result.length ==1 ){
        const user=result[0];
        const token=generate_jwt(user); // 'user' is the complete user object from db
        res.cookie("token",token,{httpOnly:true});
        res.redirect("/");
    }
    
}

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
    let n=0
    result= await db_query("SELECT COUNT(*) FROM PENDING_REQUESTS;");
    n+=Number(result);
    result= await db_query("SELECT COUNT(*) FROM ADMIN_REQUESTS;");
    n+=Number(result);
    let pending_requests=result[0]["COUNT(*)"]; 
    
    ///////////////////////////////////////////use borrowing history for implementing overdues
    overdue=1

    return res.render("admin_dash.ejs",{
        name : name,
        no_of_books : no_of_books,
        checked_out : checked_out,
        no_of_users : no_of_users,
        pending_requests : pending_requests,
        overdue : overdue
    });
}

// book catalog logic
async function getBookCatalog(req, res){
    let dataset = await db_query("SELECT * FROM BOOKS;");
    const role =req.user.role;
    const books_per_page=20;
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

// edit book page logic
async function editBook(req,res,buid){
    let book = await db_query(`SELECT * FROM BOOKS WHERE BUID=?;`,[buid]);
    book=book[0];
    res.render("edit_book_page.ejs",{book:book});
}

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
 


module.exports={
    getAdminDashData,
    getBookCatalog,
    logging,
    getBookPage,
    editBook,
    saveBookEditChanges
};