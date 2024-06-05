const dbConn = require("../configs/database")
const jwt = require("jsonwebtoken");

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



// user dashboard logic
async function getUserData(req,res){
    
    const uuid=req.user.uuid
    let result =await dbQuery("SELECT * FROM BORROWING_HISTORY NATURAL JOIN BOOKS WHERE UUID=? AND CHECKIN_DATE IS NULL;",[uuid])
    let result2=await dbQuery("SELECT * FROM PENDING_REQUESTS WHERE UUID=? AND TYPE=1",[uuid])
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

    res.render("userDash.ejs",data);
}

async function refreshToken(req,res){
    const uuid=req.user.uuid;
    let user = await dbQuery("SELECT * FROM USER WHERE UUID=?",[uuid]);
    let data={
        uuid : user[0].UUID,
        email : user[0].EMAIL, 
        name : user[0].NAME,
        role : user[0].ROLE
    }
    const cookies = req.cookies;
    if (cookies && cookies.token){
        const og_token=cookies.token;
        const payload=jwt.verify(og_token,process.env.SECRET_KEY);   
        let data2=payload.data;
        if ( data2.role != data.role){
            
            res.clearCookie("token");
            const new_token=generateJWT(data); // 'user' is the complete user object from db
            res.cookie("token",new_token,{httpOnly:true});
            return res.redirect("/");
        }
        res.redirect("/cvt_admin");
    }

}

module.exports={
    getUserData,
    refreshToken,
};
