const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

convertDbResponseToObjectResponse = (dbResponse) => {
  return {
    districtId: dbResponse.district_id,
    districtName: dbResponse.district_name,
    stateId: dbResponse.state_id,
    stateName: dbResponse.state_name,
    population: dbResponse.population,
    cases: dbResponse.cases,
    cured: dbResponse.cured,
    active: dbResponse.active,
    deaths: dbResponse.deaths,
  };
};

const verification = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await db.get(selectUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//GET states API
app.get("/states/", verification, async (request, response) => {
  const getStatesQuery = `
    select *
    from state;
    `;
  const statesArray = await db.all(getStatesQuery);
  response.send(
    statesArray.map((eachState) => convertDbResponseToObjectResponse(eachState))
  );
});

//get state API
app.get("/states/:stateId/", verification, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    select *
    from state
    where state_id=${stateId};
    `;
  const state = await db.get(getStateQuery);
  response.send(convertDbResponseToObjectResponse(state));
});

//POST districts API
app.post("/districts/", verification, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `
    insert into district (district_name, state_id, cases, cured, active, deaths)
    values ("${districtName}", ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});
    `;
  const district = await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//get district API

app.get("/districts/:districtId/", verification, async (request, response) => {
  const { districtId } = request.params;
  const getDistrictQuery = `
    select *
    from district
    where district_id=${districtId};
    `;
  const district = await db.get(getDistrictQuery);
  response.send(convertDbResponseToObjectResponse(district));
});

//delete district API
app.delete(
  "/districts/:districtId/",
  verification,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    delete
    from district
    where district_id=${districtId};
    `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//put district API
app.put("/districts/:districtId/", verification, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDistrictQuery = `
    update district
    set district_name="${districtName}",
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}
    where district_id="${districtId}";
    `;
  await db.run(updateDistrictQuery);
  response.send("District Details Updated");
});

//get stats API
app.get("/states/:stateId/stats/", verification, async (request, response) => {
  const { stateId } = request.params;
  const getStatsQuery = `
    select sum(cases) as totalCases,
    sum(cured) as totalCured,
    sum(active) as totalActive,
    sum(deaths) as totalDeaths
    from state natural join district
    where state_id=${stateId}
    group by state.state_id;
    `;
  const stats = await db.get(getStatsQuery);
  response.send(stats);
});

//get state of a district API

app.get(
  "/districts/:districtId/details/",
  verification,
  async (request, response) => {
    const { districtId } = request.params;
    const getStateOfDistrictQuery = `
    select state_name as stateName
    from state natural join district
    where district_id=${districtId};
    
    `;
    const stateName = await db.get(getStateOfDistrictQuery);
    response.send(stateName);
  }
);

module.exports = app;
