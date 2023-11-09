const express = require("express");
const { google } = require("googleapis");
const fs = require("fs");

const app = express();
const port = 3000;

const SCOPES = ["https://www.googleapis.com/auth/documents.readonly"];

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.post("/getDocHTML", async (req, res) => {
  const docId = req.body.docId;

  const auth = await authorize();
  const html = await getDocHTML(auth, docId);

  res.send(html);
});

async function authorize() {
  const content = fs.readFileSync("credentials.json");
  const credentials = JSON.parse(content);

  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  const tokenPath = "token.json";
  try {
    const token = fs.readFileSync(tokenPath);
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  } catch (err) {
    return getAccessToken(oAuth2Client);
  }
}

async function getAccessToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url:", authUrl);

  const rl = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise((resolve) => {
    rl.question("Enter the code from that page here: ", (code) => {
      rl.close();
      resolve(code);
    });
  });

  const token = await new Promise((resolve, reject) => {
    oAuth2Client.getToken(code, (err, token) => {
      if (err) reject(err);
      oAuth2Client.setCredentials(token);
      fs.writeFileSync("token.json", JSON.stringify(token));
      resolve(oAuth2Client);
    });
  });

  return token;
}

async function getDocHTML(auth, docId) {
  const docs = google.docs({ version: "v1", auth });
  const response = await docs.documents.get({ documentId: docId });
  const doc = response.data;
  let html = "";

  doc.body.content.forEach((element) => {
    if (element.paragraph) {
      html += `<p>${
        element.paragraph.elements
          ? element.paragraph.elements
              .map((e) =>
                e.textRun && e.textRun.content ? e.textRun.content : ""
              )
              .join("")
          : ""
      }</p>`;
    } else if (element.table) {
      html += "<table>";
      element.table.tableRows.forEach((row) => {
        html += "<tr>";
        row.tableCells.forEach((cell) => {
          html += `<td>${
            cell.content
              ? cell.content
                  .map((e) =>
                    e.paragraph && e.paragraph.elements
                      ? e.paragraph.elements
                          .map((e) =>
                            e.textRun && e.textRun.content
                              ? e.textRun.content
                              : ""
                          )
                          .join("")
                      : ""
                  )
                  .join("")
              : ""
          }</td>`;
        });
        html += "</tr>";
      });
      html += "</table>";
    }
  });

  return html;
}

// async function getDocHTML(auth, docId) {
//   const docs = google.docs({ version: 'v1', auth });
//   const response = await docs.documents.get({ documentId: docId });
//   const doc = response.data;
//   let html = '';

//   const processContent = (content) => {
//     if (!content) return '';

//     return content.map((e) => {
//       if (e.paragraph) {
//         return `<p>${e.paragraph.elements ? e.paragraph.elements.map((e) => (e.textRun && e.textRun.content) ? e.textRun.content : '').join('') : ''}</p>`;
//       } else if (e.table) {
//         return `<table>${e.table.tableRows.map((row) => `<tr>${row.tableCells.map((cell) => processContent(cell.content)).join('')}</tr>`).join('')}</table>`;
//       }
//       return '';
//     }).join('');
//   };

//   html += processContent(doc.body.content);

//   return html;
// }

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
