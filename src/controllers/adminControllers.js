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
 

// admin dashboard logic
async function getAdminDashData(req,res){
    let name=""; 
    for(let i of req.user.name.split(" ")){ 
        name+= (i.charAt(0).toUpperCase() + i.slice(1)); 
    }; 
    
    //use books db to get no of books
    let result= await dbQuery("SELECT COUNT(*) FROM BOOKS;");
    const no_of_books=result[0]["COUNT(*)"];
    
    //checkedout books
    result= await dbQuery("SELECT COUNT(*) FROM BOOKS WHERE CHECKIN=0;");
    const checked_out=result[0]["COUNT(*)"];
    
    // no of users
    result= await dbQuery("SELECT COUNT(*) FROM USER;");
    let no_of_users=result[0]["COUNT(*)"];

    //pending checkin/out requests + admin requests
    let pending_requests=0
    result= await dbQuery("SELECT COUNT(*) FROM PENDING_REQUESTS;");
    pending_requests+=Number(result[0]["COUNT(*)"]);
    result= await dbQuery("SELECT COUNT(*) FROM ADMIN_REQUESTS;");
    pending_requests+=Number(result[0]["COUNT(*)"]);
    
    const uuid=req.user.uuid
    let books =await dbQuery("SELECT * FROM BORROWING_HISTORY NATURAL JOIN BOOKS WHERE UUID=? AND CHECKIN_DATE IS NULL;",[uuid])
    ///////////////////////////////////////////use borrowing history for implementing overdues
    overdue=1

    return res.render("adminDash.ejs",{
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
    let book = await dbQuery(`SELECT * FROM BOOKS WHERE BUID=?;`,[buid]);
    book=book[0];
    res.render("editBookPage.ejs",{book:book});
}

// admin edit book logic
async function saveBookEditChanges(req,res,buid){
    
    const inp_name=req.body.name;
    const inp_description=req.body.description;
    if (inp_description.length>2000){
        return res.send("Can't update details: Description too long!")
    }
    if (inp_name.length>50){
        return res.send("Can't update details: Name too long!")
    }
    let result= await dbQuery(`UPDATE BOOKS SET NAME=? WHERE BUID=?`,[inp_name,buid]);
    result=await dbQuery(`UPDATE BOOKS SET DESCRIPTION=? WHERE BUID=?`,[inp_description,buid]);
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
    let result= await dbQuery(`INSERT INTO BOOKS VALUES(NULL,?,?,1)`,[inp_name,inp_description]);
    res.status(200).redirect(`/books`);
}

//admin delete book
async function deleteBook(req,res,buid){
    
    let result= await dbQuery(`DELETE FROM BOOKS WHERE BUID=?`,[buid]);
    res.status(200).redirect(`/books`);
}

async function approve(req,res,uuid,buid){
    // checkout approval reqires availablity of book and consecutive checkout entry in pending_requests 
    // checkin approval reqires unavailablity of book and consecutive checkin entry in pending_requests     
    
    const result=await dbQuery("SELECT * FROM BOOKS WHERE BUID=?",[buid])
    
    if (result.length!=1){
        return res.send("Incorrect BUID parameter!");
    }
    if (result[0]["CHECKIN"]==0){         // checkin approval
        let result2 = await dbQuery("SELECT * FROM PENDING_REQUESTS WHERE UUID=? AND BUID=?;",[uuid,buid]);
        if (result2.length==1 && result2[0]["TYPE"]==1){
            result2 = await dbQuery("DELETE FROM PENDING_REQUESTS WHERE UUID=? AND BUID=?;",[uuid,buid])
            result2 = await dbQuery("SELECT * FROM BORROWING_HISTORY WHERE UUID=? AND BUID=? AND CHECKIN_DATE IS NULL ",[uuid,buid])
            const d=new Date();
            let date=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+(d.getDate());
            result2 = await dbQuery("UPDATE BORROWING_HISTORY SET CHECKIN_DATE=? WHERE UUID=? AND BUID=? AND CHECKOUT_DATE=? ",[date,uuid,buid,result2[0]["CHECKOUT_DATE"]])
            result2= await dbQuery("UPDATE BOOKS SET CHECKIN=1 WHERE BUID=?;",[buid])
        }
    }
    if (result[0]["CHECKIN"]==1){       // checkout approval
        let result2 = await dbQuery("SELECT * FROM PENDING_REQUESTS WHERE UUID=? AND BUID=?;",[uuid,buid]);
        if (result2.length==1 && result2[0]["TYPE"]==0){
            result2 = await dbQuery("DELETE FROM PENDING_REQUESTS WHERE UUID=? AND BUID=?;",[uuid,buid])
            const d=new Date();
            let date=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+(d.getDate());
            result2 = await dbQuery("INSERT INTO BORROWING_HISTORY VALUES(?,?,?,NULL)",[uuid,buid,date])
            result2= await dbQuery("UPDATE BOOKS SET CHECKIN=0 WHERE BUID=?;",[buid])
        }
    }

    const role=req.user.role;

    if (role==="admin"){
        return res.redirect("/")
    }
    res.redirect("/pending")
}

async function deny(req,res,uuid,buid){////////////////////////////////////////////////////////////////////////////////
    let result = await dbQuery("DELETE FROM PENDING_REQUESTS WHERE UUID=? AND BUID=?;",[uuid,buid])
    res.redirect("/pending")
}

module.exports={
    getAdminDashData,
    editBook,
    saveBookEditChanges,
    approve,
    deny,
    newBook,
    deleteBook,
};