const express = require('express')
const app = express()
const PORT = process.env.PORT || 8080

const multer = require('multer')
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads')
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname) 
    }
})
const upload = multer({ storage: storage })

const fs = require('fs')
const tf = require('@tensorflow/tfjs-node')

createFileSystem()
const model = loadModel()

app.listen(
    PORT,
    () => console.log(`it's alive on http://localhost:${PORT}`)
)

app.get('/', (req, res)=>{
    res.status(200).send("All Good")
})

app.post('/upload', upload.single('evaluate'), (req, res)=>{
    loadImage(req.file.path)
        .then(transformImage)
        .then(makePrediction)
        .then(formatPrediction)
        .then((prediction)=>{
            res.status(200).send(prediction)
            fs.unlink(req.file.path, ()=>{})
        })
        .catch((err) => {
            res.status(400).send(err.toString())
            fs.unlink(req.file.path, ()=>{})
        })

})

function loadImage (path) {
    return fs.promises.readFile(path)
}

function transformImage (image) {
    const decodedImage = tf.node.decodeImage(image)
    const casted = decodedImage.cast('int32')
    const expanded = casted.expandDims(0)
    return expanded
}

async function makePrediction (transImage) {
    const net = await model
    return await net.executeAsync(transImage)
}

async function formatPrediction (prediction) {
    const scorePromise = prediction[0].array()
    const boxPromise = prediction[2].array()
    const values = await Promise.all([scorePromise, boxPromise])
    let boxes = values[1][0]
    let scores = values[0][0]
    boxes = boxes.filter((elem, ind)=>{
        return scores[ind][1]>0.75
    })
    scores = scores.filter((elem)=>{
        return elem[1]>0.75
    })
    return {boxes, scores} 
}

async function loadModel () {
    const handler = tf.io.fileSystem("model_build/model/tfjsexport/model.json")
    return await tf.loadGraphModel(handler)
}

function createFileSystem () {
    const dir  = './uploads'
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }
}



