const { dbzMovies, dbsMovies, dbMovies } = require("./movies");
const {
    dragonBallSuper,
    dragonBallKai,
    dragonBall,
    dragonBallGt,
    dragonBallZ,
} = require("./episodes");

const main = Object.values(dragonBallKai).concat(
    Object.values(dragonBallSuper).concat(
        Object.values(dragonBallGt).concat(Object.values(dragonBall))
    )
);

const mainWithZ = Object.values(dragonBallZ).concat(
    Object.values(dragonBallSuper).concat(
        Object.values(dragonBallGt).concat(Object.values(dragonBall))
    )
);

const canon = Object.values(dragonBall).concat(
    Object.values(dragonBallKai).concat(Object.values(dragonBallSuper))
);

const mainWithSuperMovies = Object.values(dragonBallKai)
    .concat(dbzMovies["16"])
    .concat(dbzMovies["17"])
    .concat(
        Object.values(dragonBallSuper)
            .slice(27)
            .concat(dbsMovies["1"])

            .concat(
                Object.values(dragonBallGt).concat(Object.values(dragonBall))
            )
    );

const movies = Object.values(dbzMovies).concat(Object.values(dbsMovies));

let streamPlaylists = {
    main: main,
    mainWithZ: mainWithZ,
    canon: canon,
    mainWithSuperMovies: mainWithSuperMovies,
    movies: movies,
};

module.exports = {
    streamPlaylists,
};
