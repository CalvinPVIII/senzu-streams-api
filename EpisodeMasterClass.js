const axios = require("axios");
const cheerio = require("cheerio");
const SockProxyAgent = require("socks-proxy-agent");
const httpsAgent = new SockProxyAgent("socks://127.0.0.1:9050");

const {
    dragonBallSuper,
    dragonBallKai,
    dragonBall,
    dragonBallGt,
    dragonBallZ,
} = require("./episodes");
const { dbMovies, dbzMovies, dbsMovies } = require("./movies");

const { streamPlaylists } = require("./playlists");

class EpisodeMasterClass {
    constructor() {
        this.db = dragonBall;
        this.dbz = dragonBallZ;
        this.dbkai = dragonBallKai;
        this.dbs = dragonBallSuper;
        this.dbgt = dragonBallGt;
        this.movies = {
            db: dbMovies,
            dbz: dbzMovies,
            dbs: dbsMovies,
        };
        this.streamPlaylist = streamPlaylists.mainWithSuperMovies;
        this.currentNonWorkingSources = ["KimAnime"];
        this.streamStatus = {
            isActive: true,
            currentSubFiles: "",
            currentDubFiles: "",
            currentEpisode: 0,
            currentTime: 0,
            episodeInfo: "",
            isInitialized: false,
            episodeDuration: 0,
            dubDuration: 0,
            subDuration: 0,
            failedToLoadVideo: false,
            dubLoadError: false,
            subLoadError: false,
        };
    }

    updateNonWorkingSources(sourceName) {
        if (this.currentNonWorkingSources.includes(sourceName)) {
            const index = this.currentNonWorkingSources.indexOf(sourceName);
            this.currentNonWorkingSources.splice(index, 1);
            return "removed";
        } else {
            this.currentNonWorkingSources.push(sourceName);
            return "added";
        }
    }

    changeStreamPlaylist(playlistName) {
        if (Object.keys(streamPlaylists).includes(playlistName)) {
            this.streamPlaylist = streamPlaylists[playlistName];
            return "Changed stream playlist to " + playlistName;
        } else {
            return "No playlist found";
        }
    }

    setCurrentEpiosde(episodeNumber) {
        if (episodeNumber >= this.streamPlaylist.length) {
            return "Episode number outside playlist length";
        } else {
            this.streamStatus.currentEpisode = episodeNumber;
            return "Current episode set to " + episodeNumber;
        }
    }

    returnMoviesBySeries(series) {
        try {
            return this.movies[series];
        } catch (error) {
            return "series not found";
        }
    }

    async returnMovie(series, movieNumber) {
        try {
            let movie = await await this.getEpisode(
                this.movies[series][movieNumber]
            );
            return movie;
        } catch (error) {
            return "error getting movie";
        }
    }

    async gogoPlayScrape(url) {
        try {
            let files = [];
            const videos = await axios.get(url, { timeout: 2000 });
            if (videos.data.mp4.length !== 0) {
                videos.data.mp4.forEach((file) => {
                    files.push(file);
                });
            }
            if (videos.data.hls) {
                files.push({
                    file: videos.data.hls,
                    label: "Auto",
                    type: "hls",
                });
            }
            if (files.length === 0) {
                return "error";
            } else {
                return files;
            }
        } catch (error) {
            console.log(error);
            return "error";
        }
    }

    gogoAnimeScrape = async (url) => {
        try {
            const html = await axios.get(url, {
                mode: "cors",
            });
            const $ = cheerio.load(html.data);
            const iframe = $("iframe").toArray()[0].attribs.src;
            const videoId = iframe.match(/(?<=\/e\/)(.*?)(?=\?domain)/gm)[0];

            const response = await axios.get(iframe, {
                mode: "cors",
                headers: {
                    referer: url,
                },
            });
            const key = response.data.match(/(?<=skey = ')(.*?)(?=')/gm)[0];

            const video = await axios.get(
                `https://vidstream.pro/info/${videoId}?domain=gogoanime.lol&skey=${key}`,
                {
                    httpsAgent,
                    mode: "cors",
                    headers: {
                        referer: iframe,
                    },
                }
            );

            return [
                {
                    file: video.data.media.sources[1].file,
                    label: "Auto",
                    type: "HLS",
                },
            ];
        } catch (error) {
            console.log(error);
            return "error";
        }
    };

    async kimAnimeScrape(url) {
        try {
            const data = await axios.get(url);
            const $ = cheerio.load(data.data);
            const page = $.html();
            const link = page.match(/(?<=embed)(.*?)(?=&quot)/gm)[0].slice(1);

            const embedPage = await axios.get(
                "https://kimanime.com/episode/embed" + link
            );
            const $$ = cheerio.load(embedPage.data);
            const video = $$("video");

            let files = [];
            Object.values(video.children("source")).forEach((child) => {
                if (child.attribs && !child.attribs.src.includes("gogo-cdn")) {
                    const fileObj = {
                        file: child.attribs.src,
                        label: child.attribs.size,
                        type: child.attribs.type,
                    };
                    files.push(fileObj);
                }
            });
            if (files.length === 0) {
                return "error";
            }
            return files;
        } catch (error) {
            console.log("error");
            console.log(error);
            return "error";
        }
    }

    owlOrganizer(url) {
        return [
            {
                file: url,
                label: "Auto",
                type: "mp4",
            },
        ];
    }

    startStream() {
        console.log("Starting video stream");
        this.streamStatus.currentTime = 0;
        this.streamStatus.isActive = true;
        this.streamStatus.isInitialized = false;
        this.handleVideoStream();
        return "Starting video stream";
    }

    stopStream() {
        console.log("Stopping stream");

        this.streamStatus.isActive = false;
        return "Stream Stopped";
    }

    // returns structured episode
    async getEpisode(episode) {
        let subFiles = [];
        let dubFiles = [];

        await Promise.all(
            episode.dub.sources.map(async (source) => {
                if (!this.currentNonWorkingSources.includes(source.source)) {
                    if (source.source === "Anime Owl") {
                        let obj = {
                            source: "Anime Owl",
                            files: this.owlOrganizer(source.video),
                        };
                        dubFiles.push(obj);
                    }
                    if (source.source === "Gogoanime") {
                        const gogoFiles = await this.gogoAnimeScrape(
                            source.video
                        );
                        if (gogoFiles != "error") {
                            const obj = {
                                source: "Gogoanime",
                                files: gogoFiles,
                            };
                            dubFiles.push(obj);
                        }
                    }
                    if (source.source === "KimAnime") {
                        const kimFiles = await this.kimAnimeScrape(
                            source.video
                        );
                        if (kimFiles != "error") {
                            const obj = {
                                source: "KimAnime",
                                files: kimFiles,
                            };
                            dubFiles.push(obj);
                        }
                    }
                    if (source.source === "Gogo") {
                        const gogoFiles = await this.gogoPlayScrape(
                            source.video
                        );
                        if (gogoFiles != "error") {
                            const obj = {
                                source: "Gogo",
                                files: gogoFiles,
                            };
                            dubFiles.push(obj);
                        }
                    }
                }
            })
        );
        await Promise.all(
            episode.sub.sources.map(async (source) => {
                if (!this.currentNonWorkingSources.includes(source.source)) {
                    if (source.source === "Anime Owl") {
                        let obj = {
                            source: "Anime Owl",
                            files: this.owlOrganizer(source.video),
                        };
                        subFiles.push(obj);
                    }
                    if (source.source === "Gogoanime") {
                        const gogoFiles = await this.gogoAnimeScrape(
                            source.video
                        );
                        if (gogoFiles != "error") {
                            const obj = {
                                source: "Gogoanime",
                                files: gogoFiles,
                            };
                            subFiles.push(obj);
                        }
                    }
                    if (source.source === "KimAnime") {
                        const kimFiles = await this.kimAnimeScrape(
                            source.video
                        );
                        if (kimFiles != "error") {
                            const obj = {
                                source: "KimAnime",
                                files: kimFiles,
                            };
                            subFiles.push(obj);
                        }
                    }
                    if (source.source === "Gogo") {
                        const gogoFiles = await this.gogoPlayScrape(
                            source.video
                        );
                        if (gogoFiles != "error") {
                            const obj = {
                                source: "Gogo",
                                files: gogoFiles,
                            };
                            subFiles.push(obj);
                        }
                    }
                }
            })
        );

        return { dub: dubFiles, sub: subFiles };
    }

    // this is used to get every episode length for a given object
    async getAllDuration(episodeObject) {
        for (const episode in episodeObject) {
            let dubLength = await this.getDuration(
                episodeObject[episode].dub.video
            );
            episodeObject[episode].dub.episodeLength = dubLength;
            let subLength = await this.getDuration(
                episodeObject[episode].sub.video
            );
            episodeObject[episode].sub.episodeLength = subLength;
            console.log(episodeObject[episode]);
        }
    }

    async initializeEpisode() {
        console.log("Initializing episode");
        this.streamStatus.isInitialized = false;
        let currentSubSources =
            this.streamPlaylist[this.streamStatus.currentEpisode].sub.sources;
        let subEpisodeDuration =
            this.streamPlaylist[this.streamStatus.currentEpisode].sub
                .episodeLength;

        let currentDubSources =
            this.streamPlaylist[this.streamStatus.currentEpisode].dub.sources;
        let dubEpisodeDuration =
            this.streamPlaylist[this.streamStatus.currentEpisode].dub
                .episodeLength;
        this.streamStatus.subDuration = subEpisodeDuration;
        this.streamStatus.dubDuration = dubEpisodeDuration;
        this.streamStatus.episodeInfo =
            this.streamPlaylist[this.streamStatus.currentEpisode].episodeInfo;

        // this gets and organizes the files for each source
        const episodeFiles = await this.getEpisode(
            this.streamPlaylist[this.streamStatus.currentEpisode]
        );

        this.streamStatus.currentDubFiles = episodeFiles.dub;
        this.streamStatus.currentSubFiles = episodeFiles.sub;

        // this sets the episode duration
        if (subEpisodeDuration >= dubEpisodeDuration) {
            this.streamStatus.isInitialized = true;
            return subEpisodeDuration;
        } else {
            this.streamStatus.isInitialized = true;
            return dubEpisodeDuration;
        }
    }

    handleMoveToNextEpisode() {
        // reset the current time and move onto the next episode
        this.streamStatus.currentTime = 0;
        this.streamStatus.currentEpisode++;
        this.streamStatus.isInitialized = false;
        // if the next episode is outside of the array

        if (this.streamStatus.currentEpisode == this.streamPlaylist.length) {
            // reset the episodes to start at the beginning
            this.streamStatus.currentEpisode = 0;
        }
    }

    async handleVideoStream() {
        // if the stream is active
        if (this.streamStatus.isActive) {
            // this gets the episode duration if it hasn't already been initialized

            if (!this.streamStatus.isInitialized) {
                console.log(
                    "Handle video stream: streamStatus is not initialized"
                );
                this.streamStatus.episodeDuration =
                    await this.initializeEpisode();
                console.log(this.streamStatus.currentDubFiles);
            }
            console.log(
                `episode duration ${this.streamStatus.episodeDuration}`
            );
            console.log(`episode number ${this.streamStatus.currentEpisode}`);

            // this section is responsible for setting the max duration and updating the info in the class every second

            // increase the current time every second
            this.streamStatus.currentTime++;
            console.log(this.streamStatus.currentTime);
            // if the current time is greater than or equal the max episode of the duration
            if (
                this.streamStatus.currentTime >=
                this.streamStatus.episodeDuration
            ) {
                this.handleMoveToNextEpisode();
                console.log(
                    `current episode is ${this.streamStatus.currentEpisode}`
                );
            }
            // call the function again to start the timer over
            this.progressStream();
        }
    }

    progressStream() {
        setTimeout(() => {
            this.handleVideoStream();
        }, 1000);
    }
}
module.exports = EpisodeMasterClass;
