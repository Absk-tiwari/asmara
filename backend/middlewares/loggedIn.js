const jwt = require('jsonwebtoken');
const JWT_SECRET = 'whateverItWas';

const loggedIn= (req, res , next)=> {
    try{
        const token = req.header('asmara-token');
        if(!token){
            return res.status(401).send({error: 'Please authenticate using correct token'})
        }
        const data = jwt.verify(token, JWT_SECRET);
        req.body.myID= data.user.id
        req.body.application_id = data.user.appKey
        next();

    } catch (err){
        return res.send({error : 'Access denied!'})
    }
}

module.exports = loggedIn;