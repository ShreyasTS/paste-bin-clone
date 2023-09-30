const express = require("express");
var bodyParser = require("body-parser");
var MongoClient = require("mongodb").MongoClient;
require("dotenv").config();

//DB config
const url = process.env.MONGO_DB_URL || "mongodb://127.0.0.1:27017/";
const client = new MongoClient(url);

const DB_NAME = process.env.DB_NAME || "pastebin";
const DB_COLLECTION_NAME = process.env.DB_COLLECTION_NAME || "pastes";
const db = client.db(DB_NAME);
const coll = db.collection(DB_COLLECTION_NAME);

async function connectDB() {
  await client
    .connect()
    .then(() => console.log("Connected Successfully"))
    .catch((error) => console.log("Failed to connect", error));
}
connectDB();

const app = express();
app.set("view engine", "ejs");

var urlencodedParser = bodyParser.urlencoded({ extended: false });

const randomId = function (length = 6) {
  return Math.random()
    .toString(36)
    .substring(2, length + 2);
};

function timeDifferenceInMinutes(dateTime1, dateTime2) {
  const timeDifference = Math.abs(new Date(dateTime2) - new Date(dateTime1)); // Get the time difference in milliseconds
  const minutes = Math.floor(timeDifference / (1000 * 60)); // Convert milliseconds to minutes
  return minutes;
}

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/paste", urlencodedParser, (req, res) => {
  res.render("getPaste");
});

app.post("/paste", urlencodedParser, (req, res) => {
  let query = { pasteid: req.body.pasteid };
  coll.findOne(query).then((result) => {
    if (
      result == null ||
      result == undefined ||
      result["data"][0]["isExpired"] == true ||
      (timeDifferenceInMinutes(new Date(), result["data"][0]["createdOn"]) >= Number(result["data"][0]["expires"]) &&
        result["data"][0]["expires"] != null &&
        result["data"][0]["expires"] != "-1")
    ) {
      if (result != null) setExpirePaste(result["pasteid"]);
      res.render("pasteDisplay", {
        bodyContent: "Either Paste ID is invalid or Paste has been expired.",
      });
    } else {
      if (result["data"][0]["isprotected"] != true || result["data"][0]["password"] === req.body.passwd) {
        if (result["data"][0]["expires"] == "-1") {
          setExpirePaste(result["pasteid"]);
          res.render("pasteDisplay", {
            pasteData: result["data"][0]["pastecontent"],
            pasteid: result["pasteid"],
            pageName: result["data"][0]["pasteName"],
            burnAfterRead: true,
          });
        } else {
          res.render("pasteDisplay", {
            pasteData: result["data"][0]["pastecontent"],
            pasteid: result["pasteid"],
            pageName: result["data"][0]["pasteName"],
          });
        }
      } else {
        if (result["data"][0]["expires"] == "-1") {
          res.render("passwordCheck", {
            pasteid: result["pasteid"],
            pageName: result["data"][0]["pasteName"],
            burnAfterRead: true,
            burnButton: "btn-danger",
          });
        } else {
          res.render("passwordCheck", {
            pasteid: result["pasteid"],
            pageName: result["data"][0]["pasteName"],
          });
        }
      }
    }
  });
});

app.post("/", urlencodedParser, async (req, res) => {
  let randId = randomId();
  let protectedPaste = req.body.passwdCheck == undefined ? false : true;
  let pastePass = req.body.passwdField == "" ? null : req.body.passwdField;
  let pastename = req.body.pasteName == "" ? null : req.body.pasteName;
  let expireDT = req.body.expiration == "X" ? null : req.body.expiration;

  try {
    var paste = {
      pasteid: randId,
      data: [
        {
          pasteName: pastename,
          pastecontent: req.body.pasteContent,
          expires: expireDT,
          isExpired: false,
          createdOn: new Date(),
          isprotected: protectedPaste,
          password: pastePass,
        },
      ],
    };
    coll.insertOne(paste).then(() => {
      console.log("New paste created.");
      res.render("pasteIdViewer", {
        pasteID: randId,
      });
    });
  } catch (error) {
    console.log("An error occured while trying to save the paste...");
    res.render("pasteDisplay", {
      bodyContent: "An error occured while creating new paste. We apologies that your paste content is lost.",
    });
  }
});

function setExpirePaste(pasteId) {
  let query = { pasteid: pasteId };
  let expireValue = { $set: { "data.0.isExpired": true } };
  coll.updateOne(query, expireValue).then(() => {
    console.log(`${pasteId} is set to Expired.`);
  });
}

//Accessing Shortened URL
app.get("/:id", async (req, res) => {
  //req.params.shortUrl
  let query = { pasteid: req.params.id };
  coll.findOne(query).then((result) => {
    if (
      result == null ||
      result == undefined ||
      result["data"][0]["isExpired"] == true ||
      (timeDifferenceInMinutes(new Date(), result["data"][0]["createdOn"]) >= Number(result["data"][0]["expires"]) &&
        result["data"][0]["expires"] != null &&
        result["data"][0]["expires"] != "-1")
    ) {
      if (result != null) setExpirePaste(result["pasteid"]);
      res.render("pasteDisplay", {
        bodyContent: "Either Paste ID is invalid or Paste has been expired.",
      });
    } else {
      // This block of code is executed only if the paste is not expired.
      if (result["data"][0]["isprotected"]) {
        if (result["data"][0]["expires"] == "-1") {
          res.render("passwordCheck", {
            pasteid: result["pasteid"],
            pageName: result["data"][0]["pasteName"],
            burnAfterRead: true,
            burnButton: "btn-danger",
          });
        } else {
          res.render("passwordCheck", {
            pasteid: result["pasteid"],
            pageName: result["data"][0]["pasteName"],
          });
        }
      } else {
        if (result["data"][0]["expires"] == "-1") {
          setExpirePaste(result["pasteid"]);
          res.render("pasteDisplay", {
            pasteData: result["data"][0]["pastecontent"],
            pasteid: result["pasteid"],
            burnAfterRead: true,
            pageName: result["data"][0]["pasteName"],
          });
        } else {
          res.render("pasteDisplay", {
            pasteData: result["data"][0]["pastecontent"],
            pasteid: result["pasteid"],
            pageName: result["data"][0]["pasteName"],
          });
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
