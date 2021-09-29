const asyncHook = require('async-hook')
const fs = require('fs')
const invokeTree = {}

function asyncHookInit(file, ctxType = null) {
    asyncHook
        .createHook({
            init(asyncId, type, triggerAsyncId) {
                // 寻找父节点
                const parent = invokeTree[triggerAsyncId]
                if (parent) {
                    invokeTree[asyncId] = {
                        pid: triggerAsyncId,
                        rootId: parent.rootId,
                        children: [],
                    }
                    // 将当前节点asyncId值保存到父节点的children数组中
                    invokeTree[triggerAsyncId].children.push(asyncId)
                }
                if (ctxType === type) fs.writeFileSync(file, JSON.stringify(invokeTree))
            }
        })
        .enable()
}





// 收集根节点上下文
const root = {}

function gc(rootId) {
    if (!root[rootId]) {
        return
    }

    // 递归收集所有节点id
    const collectionAllNodeId = (rootId) => {
        const {
            children
        } = invokeTree[rootId]
        let allNodeId = [...children]
        for (let id of children) {
            // 去重
            allNodeId = [...allNodeId, ...collectionAllNodeId(id)]
        }
        return allNodeId
    }

    const allNodes = collectionAllNodeId(rootId)

    for (let id of allNodes) {
        delete invokeTree[id]
    }

    delete invokeTree[rootId]
    delete root[rootId]
}



async function ZoneContext(fn) {
    // 初始化异步资源实例
    const asyncResource = new asyncHook.AsyncResource('ZoneContext')
    let rootId = -1
    return asyncResource.runInAsyncScope(async () => {
        try {
            rootId = asyncHook.executionAsyncId()
            // 保存 rootId 上下文
            root[rootId] = {}
            // 初始化 invokeTree
            invokeTree[rootId] = {
                pid: -1, // rootId 的 triggerAsyncId 默认是 -1
                rootId,
                children: [],
            }
            // 执行异步调用
            await fn()
        } finally {
            gc(rootId)
        }
    })
}

function findRootVal(asyncId) {
    const node = invokeTree[asyncId]
    return node ? root[node.rootId] : null
}

function setZoneContext(obj) {
    const curId = asyncHook.executionAsyncId()
    let root = findRootVal(curId)
    Object.assign(root, obj)
}



function getZoneContext() {
    const curId = asyncHook.executionAsyncId()
    return findRootVal(curId)
}
module.exports = {
    getZoneContext,
    setZoneContext,
    ZoneContext,
    asyncHookInit
}