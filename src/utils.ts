
import * as  https from 'https'
import * as  http from 'http'
import * as  path from 'path'
import * as  cheerio from 'cheerio'
/**
 * Parse a cas:authenticationSuccess XML node for CAS attributes.
 * Supports Jasig style, RubyCAS style, and Name-Value.
 *
 * @param {Object} elemSuccess
 *     DOM node
 * @return {Object}
 *     {
 *         attr1: [ attr1-val1, attr1-val2, ... ],
 *         attr2: [ attr2-val1, attr2-val2, ... ],
 *         ...
 *     }
 * @private
 */
export function _parseAttributes(elemSuccess) {
    let attributes = {}
    let elemAttribute = elemSuccess.find('cas\\:attributes').first()
    if (elemAttribute && elemAttribute.children().length > 0) {
        // "Jasig Style" Attributes:
        //
        //  <cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>
        //      <cas:authenticationSuccess>
        //          <cas:user>jsmith</cas:user>
        //          <cas:attributes>
        //              <cas:attraStyle>RubyCAS</cas:attraStyle>
        //              <cas:surname>Smith</cas:surname>
        //              <cas:givenName>John</cas:givenName>
        //              <cas:memberOf>CN=Staff,OU=Groups,DC=example,DC=edu</cas:memberOf>
        //              <cas:memberOf>CN=Spanish Department,OU=Departments,...</cas:memberOf>
        //          </cas:attributes>
        //          <cas:proxyGrantingTicket>PGTIOU-84678-8a9d2...</cas:proxyGrantingTicket>
        //      </cas:authenticationSuccess>
        //  </cas:serviceResponse>
        //
        for (let i = 0; i < elemAttribute.children().length; i++) {
            let node = elemAttribute.children()[i]
            let attrName = node.name.toLowerCase().replace(/cas:/, '')
            if (attrName !== '#text') {
                let attrValue = cheerio(node).text()
                if (attributes[attrName]) {
                    attributes[attrName].push(attrValue)
                }
                else {
                    attributes[attrName] = [attrValue]
                }
            }
        }
    }
    else {
        // "RubyCAS Style" attributes
        //
        //    <cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>
        //        <cas:authenticationSuccess>
        //            <cas:user>jsmith</cas:user>
        //
        //            <cas:attraStyle>RubyCAS</cas:attraStyle>
        //            <cas:surname>Smith</cas:surname>
        //            <cas:givenName>John</cas:givenName>
        //            <cas:memberOf>CN=Staff,OU=Groups,DC=example,DC=edu</cas:memberOf>
        //            <cas:memberOf>CN=Spanish Department,OU=Departments,...</cas:memberOf>
        //
        //            <cas:proxyGrantingTicket>PGTIOU-84678-8a9d2...</cas:proxyGrantingTicket>
        //        </cas:authenticationSuccess>
        //    </cas:serviceResponse>
        //
        for (let i = 0; i < elemSuccess.children().length; i++) {
            let node = elemSuccess.children()[i]
            let tagName = node.name.toLowerCase().replace(/cas:/, '')
            switch (tagName) {
                case 'user':
                case 'proxies':
                case 'proxygrantingticket':
                case '#text':
                    // these are not CAS attributes
                    break
                default: {
                    let attrName = tagName
                    let attrValue = cheerio(node).text()
                    if (attrValue !== '') {
                        if (attributes[attrName]) {
                            attributes[attrName].push(attrValue)
                        }
                        else {
                            attributes[attrName] = [attrValue]
                        }
                    }
                    break
                }
            }
        }
    }
    if (attributes === {}) {
        // "Name-Value" attributes.
        //
        // Attribute format from this mailing list thread:
        // http://jasig.275507.n4.nabble.com/CAS-attributes-and-how-they-appear-in-the-CAS-response-td264272.html
        // Note: This is a less widely used format, but in use by at least two institutions.
        //
        //    <cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>
        //        <cas:authenticationSuccess>
        //            <cas:user>jsmith</cas:user>
        //
        //            <cas:attribute name='attraStyle' value='Name-Value' />
        //            <cas:attribute name='surname' value='Smith' />
        //            <cas:attribute name='givenName' value='John' />
        //            <cas:attribute name='memberOf' value='CN=Staff,OU=Groups,DC=example,DC=edu' />
        //            <cas:attribute name='memberOf' value='CN=Spanish Department,OU=Departments,...' />
        //
        //            <cas:proxyGrantingTicket>PGTIOU-84678-8a9d2sfa23casd</cas:proxyGrantingTicket>
        //        </cas:authenticationSuccess>
        //    </cas:serviceResponse>
        //
        let nodes = elemSuccess.find('cas\\:attribute')
        if (nodes && nodes.length) {
            for (let i = 0; i < nodes.length; i++) {
                let attrName = nodes[i].attr('name')
                let attrValue = nodes[i].attr('value')
                if (attributes[attrName]) {
                    attributes[attrName].push(attrValue)
                }
                else {
                    attributes[attrName] = [attrValue]
                }
            }
        }
    }
    return attributes
}
/**
 *
 * @param host
 *   A domain name or IP address of the server to issue the request to. Defaults to 'localhost'.
 * @param port
 *   Port of remote server. Defaults to 443.
 * @param path
 *   Request path. Defaults to '/'. Should include query string if any. E.G.
 *   '/index.html?page=12'. An exception is thrown when the request path contains illegal
 *   characters. Currently, only spaces are rejected but that may change in the future.
 * @param ca
 *   A string, Buffer or array of strings or Buffers of trusted certificates in PEM format. If
 *   this is omitted several well known "root" CAs will be used, like VeriSign.
 *   These are used to authorize connections.
 * @param rejectUnauthorized
 *   If true, the server certificate is verified against the list of supplied CAs.
 *   An 'error' event is emitted if verification fails.
 *   Verification happens at the connection level,
 *   before the HTTP request is sent. Default true.
 * @returns {Promise} https response
 * @private
 */
export function _httpsGet({ host = '', port = 0, path = '', ca = null, rejectUnauthorized = true } = {}) {
    return new Promise((resolve, reject) => {
        let req: any = https.get({
            host: host,
            port: port,
            path: path,
            ca: ca,
            rejectUnauthorized: rejectUnauthorized
        }, res => {
            // Read result
            res.setEncoding('utf8')
            let response = ''
            res
                .on('error', e => {
                    return reject(e)
                })
                .on('data', chunk => {
                    response += chunk
                    if (response.length > 1e6) {
                        req.connection.destroy()
                    }
                })
                .on('end', () => {
                    return resolve(response)
                })
        })
        // Connection error with the CAS server
        req.on('error', function (err) {
            req.abort()
            return reject(err)
        })
    })
}
/**
 *
 * @param host
 *   A domain name or IP address of the server to issue the request to. Defaults to 'localhost'.
 * @param port
 *   Port of remote server. Defaults to 443.
 * @param path
 *   Request path. Defaults to '/'. Should include query string if any. E.G.
 *   '/index.html?page=12'. An exception is thrown when the request path contains illegal
 *   characters. Currently, only spaces are rejected but that may change in the future.
 * @returns {Promise} http response
 * @private
 */
export function _httpGet({ host = '', port = 0, path = '' } = {}) {
    return new Promise((resolve, reject) => {
        let req: any = http.get({
            host: host,
            port: port,
            path: path
        }, res => {
            // Read result
            res.setEncoding('utf8')
            let response = ''
            res
                .on('error', e => {
                    return reject(e)
                })
                .on('data', chunk => {
                    response += chunk
                    if (response.length > 1e6) {
                        req.connection.destroy()
                    }
                })
                .on('end', () => {
                    return resolve(response)
                })
        })
        // Connection error with the CAS server
        req.on('error', function (err) {
            req.abort()
            return reject(err)
        })
    })
}