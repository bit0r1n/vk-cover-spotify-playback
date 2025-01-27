import 'dotenv/config'

import { VK } from 'vk-io'
// INFO: if you don't need lastfm info, comment this
import { Lastfm, RecentTracks, TrackInfo } from './lastfm'
import { render } from './renderer'

import { ArtistsResponse, CurrentlyPlayingObject, Spotify, Track } from './spotify'

const spotify = new Spotify({
  accessToken: process.env.SPOTIFY_ACCESS_TOKEN as string,
  clientId: process.env.SPOTIFY_CLIENT_ID as string,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET as string,
  refreshToken: process.env.SPOTIFY_REFRESH_TOKEN as string
})

// INFO: if you don't need lastfm info, comment this
const lastfm = new Lastfm({
  key: process.env.LASTFM_API_KEY as string
})

const vk = new VK({
  token: process.env.VK_TOKEN as string
})

let deleted = false

const WIDTH = 1920
const HEIGHT = 640

const uploadCover = (buffer: Buffer) => (
  vk.upload.conduct({
    field: 'photo',
    params: {
      source: { value: buffer },
      crop_x: '',
      crop_width: WIDTH,
      crop_y: '',
      crop_height: HEIGHT
    },

    getServer: vk.api.photos.getOwnerCoverPhotoUploadServer,
    saveFiles: vk.api.photos.saveOwnerCoverPhoto,
    serverParams: ['crop_x', 'crop_height', 'crop_y', 'crop_width'],

    maxFiles: 1,
    attachmentType: 'photo'
  })
)

const removeCover = () => (
  vk.api.call('photos.removeOwnerCoverPhoto', {})
)

const run = async () => {
  const data = await spotify.call<CurrentlyPlayingObject>('me/player/currently-playing')

  if (data === null && !deleted) {
    deleted = true

    return removeCover()
  }

  deleted = false

  // INFO: if you don't need lastfm info, comment this bit of code
  /// lastfm start
  const currentScrobblingTrackData = await lastfm.call<RecentTracks>('user.getRecentTracks', {
    user: process.env.LASTFM_USERNAME,
    limit: 1
  })

  const currentScrobblingTrack = currentScrobblingTrackData.recenttracks.track[0]

  const scrobblesData = await lastfm.call<TrackInfo>('track.getInfo', {
    artist: currentScrobblingTrack.artist['#text'],
    track: currentScrobblingTrack.name,
    username: process.env.LASTFM_USERNAME
  })

  const scrobbles = Number.parseInt(scrobblesData.track?.userplaycount) || undefined
  /// lastfm end

  const artistIds = (data?.item as Track).artists.map(artist => artist.id).join(',')

  const artists = await spotify.call<ArtistsResponse>('artists', {
    ids: artistIds
  })

  const buffer = await render({
    width: WIDTH,
    height: HEIGHT,
    // INFO: if you don't need lastfm info, set this to 0
    // scrobbles: 0,
    scrobbles,
    artists: artists?.artists!,
    data: data!
  })

  return uploadCover(buffer)
}

vk.callbackService.onCaptcha(async (captcha, retry) => {
  // insert captcha handler here
})

run().catch(console.error)
