import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import stylex from '@stylexjs/stylex'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { ChannelBlock, Loader } from '../../components'
import { ENotificationType } from '../../components/Notification/constants'
import { InputPassword } from '../../components/molecules'
import {
  useAdminRequest,
  useClickOutside,
  useFetch,
  useMeta,
  useNotification,
  useTitle,
} from '../../hooks'
import { removeChannel } from '../../services'
import { setChannelMemesState, setMemeState } from '../../services/admin'
import { adminPasswordAtom, memesAtom, memesFilterAtom, pageOptionsAtom } from '../../store/atoms'
import { dialogConfirmationAtom } from '../../store/atoms/dialogConfirmationAtom'
import { IMeme } from '../../types'
import { EMemeState } from '../../types/enums'
import { getUrl } from '../../utils'

import { pageOptionsDefault } from '../Home/hooks/constants'

import { s } from './style'

export const MemePage = () => {
  const { id } = useParams()
  const { t } = useTranslation()
  const imgRef = useRef(null)
  const password = useAtomValue(adminPasswordAtom)
  const [memes, setMemes] = useAtom(memesAtom)
  const setNotification = useNotification()
  const { title } = useTitle(['Meme'])
  const setDialog = useSetAtom(dialogConfirmationAtom)
  const isAdmin = !!localStorage.getItem('isAdmin')
  const [isMemeActionShown, setIsMemeActionShown] = useState(false)
  const { handleAdminRequest } = useAdminRequest()
  const setMemeFilters = useSetAtom(memesFilterAtom)
  const setSearchOptions = useSetAtom(pageOptionsAtom)
  const navigate = useNavigate()
  const [operation, setOperation] = useState<
    'idle' | 'removeMeme' | 'removeChannel' | 'removeChannelMemes'
  >('idle')
  const request = useFetch<IMeme>(() => getUrl('/getMeme', { id }), {
    deps: [id],
    getCached: () => {
      return memes.length ? memes.find(meme => meme.id === id) || null : null
    },
  })

  useMeta([
    {
      name: 'og:description',
      content: request.data?.text.eng || '',
    },
    {
      name: 'description',
      content: request.data?.text.eng || '',
    },
    {
      name: 'og:title',
      content: title,
    },
    {
      name: 'og:url',
      content: window.location.href,
    },
    {
      name: 'og:image',
      content: request.data?.fileName || '',
    },
  ])

  useClickOutside(imgRef, () => {
    setIsMemeActionShown(false)
  })

  useEffect(() => {
    if (operation === 'idle') return
    else if (operation === 'removeMeme') void handleRemoveMeme()
    else if (operation === 'removeChannel') void handleRemoveChannel()
    else void handleRemoveChannelMemes()
  }, [operation])

  const checkPassword = () => {
    if (!password) {
      setNotification({
        text: t('notification.enterPassword'),
        type: ENotificationType.ERROR,
      })
      return false
    }
    return true
  }

  const handleRemoveChannel = async () => {
    if (!request.data || !checkPassword()) return
    const response = await removeChannel(request.data.channel, password)
    if (!handleAdminRequest(response)) return false
    setNotification({
      text: t('notification.channelRemoved', { channel: request.data.channel }),
      type: ENotificationType.OK,
    })
  }

  const handleRemoveChannelMemes = async () => {
    if (!request.data || !checkPassword()) return
    const response = await setChannelMemesState(request.data.channel, EMemeState.HIDDEN, password)
    if (!handleAdminRequest(response)) return false
    setNotification({
      text: t('notification.channelMemesRemoved', { channel: request.data.channel }),
      type: ENotificationType.OK,
    })
    return true
  }

  const handleRemoveMeme = async () => {
    if (!id || !checkPassword()) return
    const response = await setMemeState(id, EMemeState.HIDDEN, password)
    if (!handleAdminRequest(response)) return false
    setNotification({
      text: t('notification.memeRemoved', { id }),
      type: ENotificationType.OK,
    })
  }

  const onClickRemoveMeme = () => {
    if (!id) return
    setDialog({
      text: `${t('notification.removeMeme')} ${id}?`,
      isOpen: true,
      children: <InputPassword />,
      onClickAccept: () => {
        setOperation('removeMeme')
      },
    })
  }

  const onClickRemoveChannel = () => {
    if (!request.data) return
    setDialog({
      text: `${t('notification.removeChannel')} @${request.data.channel}?`,
      isOpen: true,
      children: <InputPassword />,
      onClickAccept: () => {
        setOperation('removeChannel')
      },
    })
  }

  const onClickChannelImages = () => {
    if (!request.data) return
    setMemeFilters({ channel: [request.data.channel] })
    setSearchOptions(pageOptionsDefault)
    setMemes([])
    navigate('/')
  }

  const onClickDeleteChannelMemes = () => {
    if (!request.data) return
    setDialog({
      text: t('notification.removeChannelMemes', { channel: request.data.channel }),
      isOpen: true,
      children: <InputPassword />,
      onClickAccept: () => {
        setOperation('removeChannelMemes')
      },
    })
  }

  if (request.isLoading) return <Loader />
  if (request.status === 204)
    return <p {...stylex.props(s.messageText)}>{t('label.unexistedMeme')}</p>
  if (request.isError || !request.data)
    return <p {...stylex.props(s.messageText)}>{t('label.errorOccured')}</p>

  return (
    <div {...stylex.props(s.meme)}>
      <div {...stylex.props(s.memeImageContainer)}>
        <img
          {...stylex.props(s.memeImage)}
          ref={imgRef}
          src={'/' + request.data.fileName}
          onClick={() => {
            setIsMemeActionShown(isAdmin && !isMemeActionShown)
          }}
        />
        {isMemeActionShown ? (
          <div {...stylex.props(s.memeActions)}>
            <FontAwesomeIcon
              icon={faTrash}
              color='red'
              size='5x'
              {...stylex.props(s.trashIcon)}
              onClick={onClickRemoveMeme}
            />
          </div>
        ) : null}
      </div>
      <div {...stylex.props(s.memeDescription)}>
        <div>
          {Object.entries(request.data.text).map(([lang, text]) => (
            <p
              key={lang}
              {...stylex.props(s.memeTextLang)}
            >
              <b>{t('label.text')}: </b>
              {text.split('\n').map((line, i) => (
                <span key={i}>{line}</span>
              ))}
            </p>
          ))}
        </div>
        <div>
          <b>{t('label.source')}: </b>
          <ChannelBlock
            isAdmin={isAdmin}
            username={request.data.channel}
            id={request.data.messageId}
            {...stylex.props(s.sourceBlock)}
            onClickImages={onClickChannelImages}
            onClickEraser={onClickDeleteChannelMemes}
            onClickRemove={onClickRemoveChannel}
          />
        </div>
      </div>
    </div>
  )
}
