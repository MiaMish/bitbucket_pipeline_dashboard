/* eslint-disable no-shadow */

import axios from 'axios';
import moment from 'moment';

import { STORAGE_USER_INFO } from '@/constants';

import {
    IMPLICIT_GRANT_LINK,
    GET_USER_INFO,
    GET_REPOSITORIES,
    GET_PIPELINE_STATUS,
    CALL_BITBUCKET_API,
    TOGGLE_SELECTED_REPOSITORY,
} from './actions.type';

import {
    SET_USER_INFO,
    CLEAR_USER_INFO,
    SET_REPOSITORIES,
    SET_PIPELINES,
    SET_SELECTED_REPOSITORY,
} from './mutations.type';

function convertResultToLevel(result) {
    const LEVEL = {
        RUNNING: 5,
        FAILED: 3,
        STOPPED: 2,
        SUCCESSFUL: 0,
    };

    return LEVEL[result];
}

function convertResultToColor(result) {
    const COLOR = {
        FAILED: 'red',
        RUNNING: 'amber',
        SUCCESSFUL: 'light-green',
    };

    return `${COLOR[result]}--text`;
}

function convertResultToIcon(result) {
    const ICON = {
        FAILED: 'error_outline',
        RUNNING: 'refresh',
        SUCCESSFUL: 'done',
    };

    return ICON[result];
}

function formatPipelineTitle(x) {
    if (x.target.selector &&
        x.target.selector.type === 'custom') {
        return `${x.trigger.name}: trigger ${x.target.selector.type} ${x.target.selector.pattern}`;
    }

    return `${x.trigger.name}: trigger ${x.target.ref_type} ${x.target.ref_name}`;
}

const state = {
    clientId: 'yJgF4XwcEqNs7maaYP',
    apiUrl: 'https://api.bitbucket.org/2.0',
    repositories: [],
    pipelines: [],
    userInfo: localStorage.getItem(STORAGE_USER_INFO) || '',
};

export const getters = {
    selectedRepositories({ repositories }) {
        return repositories.filter(x => x.selected);
    },
    getUserInfo({ userInfo }) {
        if (!userInfo) return null;

        try {
            return JSON.parse(userInfo);
        } catch (e) {
            console.log(e);
            return null;
        }
    },
    temporary() {
        const REPO_TO_BE_MONITORED = [
            'kaibo_setup',
            'kaibo_core',
            'kaibo_compo',
            'kaibo_compomock',
            'kaibo_config',
            'kaibo_dashboard',
            'kaibo_globalcompo',
            'kaibo_hw_compo',
            'kaibo_internet_remote',
            'kaibo_launcher',
            'kaibo_locker',
            'kaibo_nfc',
            'kaibo_recordeddata',
            'kaibo_recplay',
            'kaibo_tools',
            'kaibo_visualizer',
            'kaibo_cmake',
            'kaibo_licenseappender',
            'kaibo_webservicebenchmark',
            'zmp-canusbz',
            'zmp-jsmpeg',
            'zmp_serializer',
        ];

        return REPO_TO_BE_MONITORED.map(x => ({
            fullName: `ichigo_zmp/${x}`,
        }));
    },
};

export const mutations = {
    [SET_USER_INFO](state, data) {
        const userInfo = JSON.stringify({
            accountId: data.account_id,
            avatar: data.links.avatar.href,
            userLink: data.links.html.href,
            userName: data.username,
        });

        state.userInfo = userInfo;
        localStorage.setItem(STORAGE_USER_INFO, userInfo);
    },
    [CLEAR_USER_INFO](state) {
        localStorage.removeItem(STORAGE_USER_INFO);
        state.userInfo = '';
    },
    [SET_REPOSITORIES](state, data) {
        const values = data.values || [];

        state.repositories = values.map(x => {
            const { uuid } = x;
            const selected = localStorage.getItem(uuid) || false;

            return {
                fullName: x.full_name,
                name: x.name,
                slug: x.slug,
                uuid,
                link: x.links.html.href,
                updatedOn: x.updated_on,
                avatar: x.links.avatar.href,
                selected,
            };
        });
    },
    [SET_PIPELINES](state, data) {
        const values = data || [];

        state.pipelines = values
            .map(x => {
                const pipelineTitle = formatPipelineTitle(x);
                const result = (x.state.result && x.state.result.name) || 'RUNNING';
                const resultLevel = convertResultToLevel(result);
                const resultColor = convertResultToColor(result);
                const resultIcon = convertResultToIcon(result);

                return {
                    uuid: x.uuid,
                    repoSlug: x.repository.full_name,
                    id: x.build_number,
                    pipelineTitle,
                    status: x.state.name || '',
                    result,
                    resultLevel,
                    resultColor,
                    resultIcon,
                    userName: x.creator.display_name,
                    avatar: x.creator.links.avatar.href,
                    link: `https://bitbucket.org/${x.repository.full_name}/addon/pipelines/home#!/results/${x.build_number}`,
                    completedOn: moment(x.completed_on).fromNow(),
                    createdOn: moment(x.created_on).fromNow(),
                    time: moment(x.created_on).valueOf(),
                    buildSeconds: x.build_seconds_used,
                };
            })
            .sort((a, b) => (b.resultLevel - a.resultLevel || b.time - a.time));
    },
    [SET_SELECTED_REPOSITORY](state, index) {
        const status = state.repositories[index].selected;
        state.repositories[index].selected = !status;

        const value = state.repositories[index].selected;
        const key = state.repositories[index].uuid;

        if (value) {
            localStorage.setItem(key, value);
        } else {
            localStorage.removeItem(key);
        }
    },
};

export const actions = {
    [IMPLICIT_GRANT_LINK]({ state }) {
        return `https://bitbucket.org/site/oauth2/authorize?client_id=${state.clientId}&response_type=token`;
    },
    [TOGGLE_SELECTED_REPOSITORY]({ commit }, index) {
        commit(SET_SELECTED_REPOSITORY, index);
    },
    async [GET_USER_INFO]({ state, dispatch, commit }) {
        const url = `${state.apiUrl}/user?fields=account_id,links.avatar.href,links.html.href,username`;

        try {
            const res = await dispatch(CALL_BITBUCKET_API, url);

            if (res.status === 200) {
                commit(SET_USER_INFO, res.data);
            }
        } catch (e) {
            console.log(e);
        }
    },
    async [GET_REPOSITORIES]({
        state, dispatch, getters, commit,
    }) {
        const { userName } = getters.getUserInfo;
        const url = `${state.apiUrl}/repositories/${userName}`;

        try {
            const res = await dispatch(CALL_BITBUCKET_API, url);

            if (res.status === 200) {
                commit(SET_REPOSITORIES, res.data);
            }
        } catch (e) {
            console.log(e);
        }
    },
    async [GET_PIPELINE_STATUS]({
        state, getters, dispatch, commit,
    }) {
        // const urls = getters.temporary
        const urls = getters.selectedRepositories
            .map(x => `${state.apiUrl}/repositories/${x.fullName}/pipelines/?sort=-created_on&pagelen=100`);

        try {
            const res = await Promise.all(urls.map(x => dispatch(CALL_BITBUCKET_API, x)));

            const pipelines = res.filter(x => x.status === 200)
                .filter(x => x.data.size > 0)
                .map(x => x.data.values[0]);

            commit(SET_PIPELINES, pipelines);
        } catch (e) {
            console.log(e);
        }
    },
    async [CALL_BITBUCKET_API]({ getters }, url) {
        const token = getters.getToken;

        try {
            const res = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            return res;
        } catch (e) {
            throw e;
        }
    },
};

export default {
    state,
    actions,
    getters,
    mutations,
};
