import { User } from "../models/user.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose, { trusted } from "mongoose";

const generateAccessAndRefreshTokens = async (userId) =>{
    try {
        console.log("shuru to hua")
        const user = await User.findById(userId)
        if(!user){
            console.log("user ni mila yrr")
        }
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save ({validateBeforeSave : false})
        return { accessToken, refreshToken }

    } catch (error) {
        console.log("messedup!")
        throw new ApiError (500 , "Error during generating tokens")
    }
}

const loginUser = asyncHandler (async (req, res) => {
    ////fetch userdata
    //find through username/email
    //password check
    //generate access and refresh tokens
    //send cookies

    const{identifier, password} = req.body;

    if(! (identifier)) {
        throw new ApiError (400, "Username or email is required")
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();

    const user = await User.findOne({
        $or: [
            { username: normalizedIdentifier },
            { email: normalizedIdentifier }
        ]
    });

    if(!user){
        throw new ApiError (404 ,"User does not exist",)
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid){
        throw new ApiError(401, "Invalid user creddentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedinUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).cookie("accessToken",accessToken, options).cookie("refreshToken",refreshToken,options).json(
        new ApiResponse(200, {user: loggedinUser,accessToken, refreshToken}, "User logged in successfully")
    )
})

const logoutUser = asyncHandler (async (req, res)=> {
    await User.findByIdAndUpdate(
        req.user._id,{
            $unset: {
                refreshToken: 1 //remove tokens from docu
            }
        },
        {
            new:true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).clearCookie("accessToken",options).clearCookie("refreshToken",options).json(new ApiResponse (200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler (async (req, res) => {
    const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorised request")
    }
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})

const getUser = asyncHandler( async(req, res,) => {
    return res.status(200).json( 
        new ApiResponse (
        200, req.user,"User details fetched"
        )
    )
})

const changePassword = asyncHandler (async (req,res) =>{
    const {oldPassword, newPassword} = req.body;
    const user = await User.findById(req.user?._id)
    const isPasswordValid = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid old password")
    }
    user.password = newPassword
    await user.save({validBeforeSave: false})

    return res.status(200).json(new ApiResponse(200,{},"Password changed successfully"))
})