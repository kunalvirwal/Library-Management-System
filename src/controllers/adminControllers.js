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

    result= await dbQuery("SELECT COUNT(*) FROM USER WHERE ADMIN_REQUEST=1;");
    pending_requests+=Number(result[0]["COUNT(*)"]);
    
    const uuid=req.user.uuid
    let books =await dbQuery("SELECT * FROM BORROWING_HISTORY NATURAL JOIN BOOKS WHERE UUID=? AND CHECKIN_DATE IS NULL;",[uuid]);
    let past_books = await dbQuery("SELECT * FROM BORROWING_HISTORY NATURAL JOIN BOOKS WHERE UUID=? AND CHECKIN_DATE IS NOT NULL;",[uuid])
    ///////////////////////////////////////////use borrowing history for implementing overdues
    overdue=1
    return res.render("adminDash.ejs",{
        name : name,
        no_of_books : no_of_books,
        checked_out : checked_out,
        no_of_users : no_of_users,
        pending_requests : pending_requests,
        overdue : overdue,
        books : books,
        past_books : past_books.reverse(),
        path : req.path
    });
}

// admin edit book page logic
async function editBook(req,res,buid){
    let book = await dbQuery(`SELECT * FROM BOOKS WHERE BUID=?;`,[buid]);
    book=book[0];
    res.render("editBookPage.ejs",{book : book,path : req.path});
}

// admin edit book logic
async function saveBookEditChanges(req,res,buid){
    
    const inp_name=req.body.name.trim();
    const inp_description=req.body.description.trim();
    const inp_quantity=req.body.qty;
    if (inp_description.length>2000 || inp_name.length>50){
        return res.status(400).redirect(`/admin/editbook/${buid}`);  // Can't update details: Description too long! ||  // Can't update details: Name too long!
    }
    let result= await dbQuery("SELECT * FROM BOOKS WHERE BUID=?;",[buid]);
    const checked_out=result[0]["TOTAL"]-result[0]["CHECKIN"];
    if(inp_quantity<checked_out){
        return res.status(403).redirect(`/admin/editbook/${buid}`);  // Can't decrease quantity under a certain value
    }
    let decrease=result[0]["TOTAL"]-inp_quantity;
    let decrease_checkin= result[0]["CHECKIN"]-decrease;
    result= await dbQuery(`UPDATE BOOKS SET NAME=? WHERE BUID=?`,[inp_name,buid]);
    result=await dbQuery(`UPDATE BOOKS SET DESCRIPTION=? WHERE BUID=?`,[inp_description,buid]);
    result=await dbQuery(`UPDATE BOOKS SET TOTAL=? WHERE BUID=?`,[inp_quantity,buid]);
    result=await dbQuery(`UPDATE BOOKS SET CHECKIN=? WHERE BUID=?`,[decrease_checkin,buid]);
    res.status(200).redirect(`/books/${buid}`);
}

// admin create new book
async function newBook(req,res){
    const inp_name=req.body.name;
    const inp_description=req.body.description;
    const inp_quantity=req.body.qty;
    if (inp_description.length>2000){
        return res.status(400).redirect(`/admin/addbook`);  // Can't update details: Description too long!
    } else if (inp_description.trim().length==0){
        return res.status(400).redirect(`/admin/addbook`);  // Can't update details: Description too short!
    }
    if (inp_name.length>50){
        return res.status(400).redirect(`/admin/addbook`);  // Can't update details: Name too long!
    } else if (inp_name.trim().length==0){
        return res.status(400).redirect(`/admin/addbook`);  // Can't update details: Name too short!
    }

    let result= await dbQuery(`INSERT INTO BOOKS VALUES(NULL,?,?,?,?)`,[inp_name.trim(),inp_description.trim(),inp_quantity,inp_quantity]);
    
    res.status(200).redirect(`/books`);
}

//admin delete book
async function deleteBook(req,res,buid){
    let result= await dbQuery(`Select * FROM BOOKS WHERE BUID=?`,[buid]);
    if (result[0]["CHECKIN"]!=result[0]["TOTAL"]){   // cant delete book if all books are not checked in
        return res.redirect(`/books/${buid}`)
    }
    req.cantdelete=false
    let result2= await dbQuery(`DELETE FROM BOOKS WHERE BUID=?`,[buid]);
    res.status(200).redirect(`/books`);
}

async function approve(req,res,uuid,buid){
    // checkout approval reqires availablity of book and consecutive checkout entry in pending_requests 
    // checkin approval reqires unavailablity of book and consecutive checkin entry in pending_requests     
    
    const result=await dbQuery("SELECT * FROM BOOKS WHERE BUID=?",[buid])
    let result2=await dbQuery("SELECT * FROM PENDING_REQUESTS WHERE UUID=? AND BUID=?",[uuid,buid])
    
    if (result.length!=1){
        return res.status(400).redirect("/pending")  //  Incorrect BUID parameter!
    }

    if(result2.length!=1){
        return res.status(404).redirect("/pending") //  Pending Request not found!

    }
    
    
    if (result2[0]["TYPE"]==1){     //checkin approval

        let result3 = await dbQuery("DELETE FROM PENDING_REQUESTS WHERE UUID=? AND BUID=?;",[uuid,buid])
        result3 = await dbQuery("SELECT * FROM BORROWING_HISTORY WHERE UUID=? AND BUID=? AND CHECKIN_DATE IS NULL ",[uuid,buid])
        const d=new Date();
        let date=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+(d.getDate());
        result3 = await dbQuery("UPDATE BORROWING_HISTORY SET CHECKIN_DATE=? WHERE UUID=? AND BUID=? AND CHECKOUT_DATE=? ",[date,uuid,buid,result3[0]["CHECKOUT_DATE"]]);
        result3= await dbQuery("UPDATE BOOKS SET CHECKIN=? WHERE BUID=?;",[(result[0]["CHECKIN"]+1),buid])
        
    }
    
    if (result2[0]["TYPE"]==0 && result[0]["CHECKIN"]>=1){   //checkout approval 
        let  result3= await dbQuery("DELETE FROM PENDING_REQUESTS WHERE UUID=? AND BUID=?;",[uuid,buid])
        const d=new Date();
        let date=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+(d.getDate());
        result3 = await dbQuery("INSERT INTO BORROWING_HISTORY VALUES(?,?,?,NULL)",[uuid,buid,date])
        result3= await dbQuery("UPDATE BOOKS SET CHECKIN=? WHERE BUID=?;",[(result[0]["CHECKIN"]-1),buid])
        
    }

    result2=await dbQuery("SELECT * FROM USER WHERE UUID=?;",[uuid]);

    if (result2[0]["ROLE"]==="admin"){
        return res.redirect("/");
    }

    res.redirect("/pending")
    
}

async function deny(req,res,uuid,buid){
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