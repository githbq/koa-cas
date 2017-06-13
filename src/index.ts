
import * as  https from 'https'
import * as  http from 'http'
import * as  url from 'url'
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
/**
 * 替换 \ 为 /
 */
function replaceSep(str: string) {
    return str.replace(/\\/g, '/')
}

function _parseAttributes(elemSuccess) {
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
                } else {
                    attributes[attrName] = [attrValue]
                }
            }
        }
    } else {
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
                        } else {
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
                } else {
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
function _httpsGet({
    host = '',
    port = 0,
    path = '',
    ca = null,
    rejectUnauthorized = true
                    } = {}) {
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
function _httpGet({
                     host = '',
    port = 0,
    path = ''
                   } = {}) {
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

export class CAS {
    /**
    * Initialize CAS with the given `options`.
    * @param
    *  {
    *      'baseUrl':
    *           The full URL to the CAS server, including the base path.
    *       'validateTicketUrl':
    *          The full URL to the validate CAS ticket server, including the base path.
    *          Default equal baseUrl.
    *       'service':
    *           The URL of the page being authenticated. Can be omitted here and
    *           specified during validate(). Or detected automatically during
    *           authenticate().
    *       'secureSSL':
    *           If true, the server certificate is verified against the list of supplied CAs.
    *           An 'error' event is emitted if verification fails.
    *           Verification happens at the connection level,
    *           before the HTTP request is sent.
    *           Default true.
    *
    *  }
    */
    public casUrl: any
    public vtUrl: any
    public service: any
    public secureSSL: any
    constructor({
                 baseUrl = '',
        validateTicketUrl = '',
        service = '',
        secureSSL = true
               } = {}) {
        if (!baseUrl) {
            throw new Error('Required CAS option `baseUrl` missing.')
        }

        if (!validateTicketUrl) {
            validateTicketUrl = baseUrl
        }

        this.casUrl = url.parse(baseUrl)
        this.vtUrl = url.parse(validateTicketUrl)

        if (this.casUrl.protocol !== 'https:') {
            throw new Error('Only https CAS servers are supported.')
        }
        if (!this.casUrl.hostname) {
            throw new Error('Option `base_url` must be a valid url like: https://example.com/cas')
        }

        this.service = service
        this.secureSSL = secureSSL
        this.casUrl.port = this.casUrl.port ? this.casUrl.port : 443
    }

    /**
     * Handle a single sign-out request from the CAS server.
     *
     * In CAS 3.x the server keeps track of all the `ticket` and `service` values
     * associated with each user. Then when the user logs out from one site, the
     * server will contact every `service` they have authenticated with and POST
     * a sign-out request containing the original `ticket` used to login.
     *
     * This is optional. But if you do use this, it must come before authenticate().
     * Also, it will only work if the service is accessible on the network by the
     * CAS server.
     *
     * Unlike the other functions in this module, this one will only work
     * with Express or something else that pre-processes the body of a POST
     * request. It is not compatible with basic node.js http req objects.
     *
     * @param {Object} ctx
     *      Kao context.
     * @returns {String} ticket
     */
    handleSingleSignout(ctx) {
        let ticket
        let request = ctx.request

        if (ctx.method === 'POST' && request.body.logoutRequest) {
            try {
                // This was a signout request. Parse the XML.
                let $ = cheerio.load(request.body.logoutRequest)
                let ticketElems = $('samlp\\:SessionIndex')

                if (ticketElems && ticketElems.length > 0) {
                    // This is the ticket that was issued by CAS when the user
                    // first logged in. Pass it into the callback so the
                    // application can use it to delete the user's session.
                    ticket = ticketElems.first().text().trim()
                }
            } catch (err) {
                // This was not a valid signout request.
            }
        }

        return ticket
    }

    async validate(ticket, service) {
        // Use different CAS path depending on version
        let validatePath = ''

        if (ticket.indexOf('PT-') === 0) {
            validatePath = 'proxyValidate'
        } else {
            validatePath = 'serviceValidate'
        }

        // Service URL can be specified in the function call, or during
        // initialization.
        let serviceUrl = service || this.service

        if (!serviceUrl) {
            throw new Error('Required CAS option `service` missing.')
        }

        let query = {
            'ticket': ticket,
            'service': serviceUrl
        }

        let queryPath = url.format({
            pathname: replaceSep(path.join(this.casUrl.pathname, '/', validatePath)),
            query: query
        })

        let request = this.vtUrl.protocol === 'https:' ? _httpsGet : _httpGet
        let result = await request({
            host: this.vtUrl.hostname,
            port: this.vtUrl.port,
            path: queryPath,
            rejectUnauthorized: this.secureSSL
        })

        // CAS 2.0 (XML response, and extended attributes)
        // Use cheerio to parse the XML repsonse.
        let $ = cheerio.load(result)
        // Check for auth success
        let elemSuccess = $('cas\\:authenticationSuccess').first()

        if (elemSuccess && elemSuccess.length > 0) {
            let elemUser = elemSuccess.find('cas\\:user').first()

            if (!elemUser || elemUser.length < 1) {
                //  This should never happen
                throw new Error('No username?')
            }

            // Got username
            let username = elemUser.text()

            // Look for optional proxy granting ticket
            let pgtIOU = ''
            let elemPGT = elemSuccess.find('cas\\:proxyGrantingTicket').first()

            if (elemPGT) {
                pgtIOU = elemPGT.text()
            }

            // Look for optional proxies
            let proxies = []
            let elemProxies = elemSuccess.find('cas\\:proxies')

            for (let i = 0; i < elemProxies.length; i++) {
                let thisProxy = $(elemProxies[i]).text().trim()

                proxies.push(thisProxy)
            }

            // Look for optional attributes
            let attributes = _parseAttributes(elemSuccess)
            // 包装resolve返回值

            return {
                err: undefined,
                status: true,
                username: username,
                extended: {
                    username: username,
                    attributes: attributes,
                    PGTIOU: pgtIOU,
                    ticket: ticket,
                    proxies: proxies
                }
            }
        } // end if auth success

        // Check for correctly formatted auth failure message
        let elemFailure = $('cas\\:authenticationFailure').first()

        if (elemFailure && elemFailure.length > 0) {
            let code = elemFailure.attr('code')
            let message = 'Validation failed [' + code + ']: '

            message += elemFailure.text()
            throw new Error(message)
        }

        // The response was not in any expected format, error
        throw new Error('Bad response format.')
    }

    /**
     * Force CAS authentication on a web page. If users are not yet authenticated,
     * they will be redirected to the CAS server to log in there.
     *
     * @param {object} ctx
     *      Kao context.
     * @param {String} service
     *      (optional) The URL of the service/page that requires authentication.
     *      Default is to extract this automatically from
     *      the `req` object.
     */
    async authenticate(ctx, service) {
        let reqURL = url.parse(ctx.url, true)
        // Try to extract the CAS ticket from the URL
        let ticket = reqURL.query.ticket

        // Obtain the service URL automatically if it wasn't provided
        if (!service) {
            // Get the URL of the current page, minus the 'ticket'
            delete reqURL.query.ticket
            service = url.format({
                protocol: ctx.protocol || 'http',
                host: ctx.get('x-forwarded-host') || ctx.get('host'),
                pathname: reqURL.pathname,
                query: reqURL.query
            })
        }

        // We have a ticket!
        if (ticket) {
            // Validate it with the CAS server now
            return await this.validate(ticket, service)
        } else {
            // No ticket, so we haven't been sent to the CAS server yet
            // redirect to CAS server now
            let redirectURL = url.format({
                protocol: this.casUrl.protocol,
                hostname: this.casUrl.hostname,
                port: this.casUrl.port,
                pathname: replaceSep(path.join(this.casUrl.pathname, '/login')),
                search: `service=${encodeURIComponent(service)}`
            })

            ctx.status = 307
            ctx.set('Location', redirectURL)
            ctx.redirect(redirectURL)
            ctx.body = '<a href="' + redirectURL + '">CAS logout</a>'
        }
    }

    /**
     * Log the user out of their CAS session. The user will be redirected to
     * the CAS server for this.
     *
     * @param {Object} ctx
     *     Kao context.
     * @param {String} returnUrl
     *     (optional) The URL that the user will return to after logging out.
     */
    logout(ctx, returnUrl = '') {
        if (!returnUrl) {
            returnUrl = url.format({
                protocol: ctx.protocol || 'http',
                host: ctx.get('x-forwarded-host') || ctx.get('host')
            })
        }

        // Logout with auto redirect
        let redirectURL = url.format({
            protocol: this.casUrl.protocol,
            hostname: this.casUrl.hostname,
            port: this.casUrl.port,
            pathname: replaceSep(path.join(this.casUrl.pathname, '/logout')),
            search: `service=${encodeURIComponent(returnUrl)}`
        })

        ctx.status = 307
        ctx.set('Location', redirectURL)
        ctx.redirect(redirectURL)
        ctx.body = '<a href="' + redirectURL + '">CAS logout</a>'
    }
}

export default CAS
